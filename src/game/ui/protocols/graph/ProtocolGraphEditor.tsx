import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type {
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolNode,
  ProtocolNodeKind,
  ProtocolValidationFinding,
} from '../../../domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS } from '../../../simulation/SimulationConfig';
import {
  appliedProtocol,
  checkProtocolDraft,
  createProtocolDraft,
  editProtocolDraft,
  edgeFindingSeverity,
  nodeFindingSeverity,
  orderedFindings,
  protocolApplyBlock,
  protocolFindingCounts,
  savedDraftProtocol,
  type ProtocolDraftState,
} from '../protocolDraftModel';
import type { ProtocolTranslate } from '../protocolSummary';
import { ProtocolNodeCard, type ProtocolFlowNode } from './ProtocolNodeCard';
import { ProtocolNodeSettings } from './ProtocolNodeSettings';
import {
  connectionRejectionKey,
  evaluateProtocolConnection,
  type ProtocolConnectionCandidate,
} from './protocolConnectionRules';
import {
  addProtocolNode,
  connectProtocolNodes,
  createEditorNode,
  disconnectProtocolEdge,
  nextNodeId,
  removeProtocolNode,
  updateProtocolNode,
} from './protocolEditorModel';
import { buildProtocolFlowView } from './protocolFlowView';
import { layoutProtocolGraph, nextFreePlacement, type ProtocolCanvasPoint } from './protocolGraphLayout';
import {
  PROTOCOL_NODE_CARD_WIDTH,
  PROTOCOL_NODE_PALETTE,
  nodeCardHeight,
} from './protocolNodePresentation';

/**
 * Graph Editor (spec §14.2): düğüm paleti + canvas + bağlantı kuralları + draft/apply.
 *
 * Düzenleme protokolün ÇALIŞMA KOPYASI üzerinde yapılır. `Kontrol Et` yalnız Faz 5
 * doğrulayıcısını çalıştırır — gelecek sonucu çözmez (satır 1059). `Uygula` protokolü
 * kitaplığa yazar; simülasyonu DURAKLATMAZ (satır 1060) ve yalnız doğrulaması güncel
 * ve hatasız taslakta açıktır. Uyarı uygulamayı engellemez (§53.3).
 */

const NODE_TYPES: NodeTypes = { protocolNode: ProtocolNodeCard };

const ZOOM_MINIMUM = 0.4;
const ZOOM_MAXIMUM = 1.6;
/** §8: 24 px aralıklı nokta ızgara. */
const CANVAS_DOT_GAP = 24;
/** §17.3: sonuç şeridinde en çok üç bulgu listelenir, kalanı sayıyla özetlenir. */
const RESULT_FINDING_LIMIT = 3;

export interface ProtocolEditorHost {
  /** Düzenleyicinin alan seçenekleri için kullandığı, tik başına değişmeyen capability. */
  readonly capabilities: ProtocolCapabilities;
  readonly onApply: (protocol: ProtocolDefinition) => void;
  readonly onSaveDraft: (protocol: ProtocolDefinition) => void;
  /** `Kontrol Et` anındaki yetkili durumla üretilmiş capability (§53.3 "zaten bu değerde"). */
  readonly readCapabilities: () => ProtocolCapabilities;
}

function initialPositions(definition: ProtocolDefinition): ReadonlyMap<string, ProtocolCanvasPoint> {
  return new Map(layoutProtocolGraph(definition).map((placement) => [placement.nodeId, { x: placement.x, y: placement.y }]));
}

function ProtocolGraphEditorSurface({ host, protocol }: { readonly host: ProtocolEditorHost; readonly protocol: ProtocolDefinition }) {
  const { t: translate } = useTranslation();
  const t = translate as ProtocolTranslate;
  const { fitView, getZoom, setCenter, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();

  const [draft, setDraft] = useState<ProtocolDraftState>(() => createProtocolDraft(protocol));
  const [positions, setPositions] = useState<ReadonlyMap<string, ProtocolCanvasPoint>>(() => initialPositions(protocol));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('');
  const [resultOpen, setResultOpen] = useState(false);

  const definition = draft.definition;
  const report = draft.report;

  const view = useMemo(() => buildProtocolFlowView(definition, positions, t, host.capabilities), [definition, host.capabilities, positions, t]);

  const flowNodes = useMemo<ProtocolFlowNode[]>(() => view.nodes.map((node) => {
    const finding = nodeFindingSeverity(report, node.id);
    return {
      data: {
        ...(finding === undefined ? {} : { finding }),
        height: node.height,
        inputs: node.inputs,
        kind: node.kind,
        lines: node.lines,
        outputs: node.outputs,
        typeLabel: node.typeLabel,
      },
      id: node.id,
      position: { x: node.x, y: node.y },
      selected: node.id === selectedNodeId,
      type: 'protocolNode',
    };
  }), [report, selectedNodeId, view.nodes]);

  const flowEdges = useMemo<Edge[]>(() => view.edges.map((edge) => {
    const finding = edgeFindingSeverity(report, edge.id);
    return {
      className: `protocol-edge protocol-edge-${edge.edgeClass}${finding === undefined ? '' : ` protocol-edge-finding-${finding}`}`,
      id: edge.id,
      ...(edge.label === undefined ? {} : { label: edge.label }),
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
    };
  }), [report, view.edges]);

  /** Her düzenleme doğrulama sonucunu bayatlatır; şerit da kapanır. */
  const edit = useCallback((next: ProtocolDefinition) => {
    setDraft((current) => editProtocolDraft(current, next));
    setResultOpen(false);
  }, []);

  const candidateOf = useCallback((connection: Connection | Edge): ProtocolConnectionCandidate | undefined => {
    const sourceHandle = 'sourceHandle' in connection ? connection.sourceHandle : undefined;
    const targetHandle = 'targetHandle' in connection ? connection.targetHandle : undefined;
    if (typeof sourceHandle !== 'string' || typeof targetHandle !== 'string') return undefined;
    return { from: { nodeId: connection.source, port: sourceHandle }, to: { nodeId: connection.target, port: targetHandle } };
  }, []);

  const handleNodesChange = useCallback((changes: NodeChange<ProtocolFlowNode>[]) => {
    const moved = changes.filter((change) => change.type === 'position' && change.position !== undefined);
    if (moved.length > 0) {
      setPositions((current) => {
        const next = new Map(current);
        for (const change of moved) {
          if (change.type !== 'position' || change.position === undefined) continue;
          next.set(change.id, { x: change.position.x, y: change.position.y });
        }
        return next;
      });
    }
    for (const change of changes) {
      if (change.type !== 'select') continue;
      const { id, selected } = change;
      setSelectedNodeId((current) => (selected ? id : current === id ? null : current));
    }
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    const candidate = candidateOf(connection);
    if (candidate === undefined) return;
    const result = connectProtocolNodes(definition, candidate, host.capabilities);
    edit(result.definition);
    setNotice(result.verdict.rejection === undefined ? '' : t(connectionRejectionKey(result.verdict.rejection)));
  }, [candidateOf, definition, edit, host.capabilities, t]);

  /** React Flow bu `false` dönerse bağlantıyı KURMAZ — engelleme burada olur. */
  const isValidConnection = useCallback((connection: Connection | Edge): boolean => {
    const candidate = candidateOf(connection);
    if (candidate === undefined) return false;
    return evaluateProtocolConnection(definition, candidate, host.capabilities).allowed;
  }, [candidateOf, definition, host.capabilities]);

  /** Engellenen denemenin gerekçesi: bırakılan uç bilinince doğal Türkçe cümleye çevrilir. */
  const handleConnectEnd = useCallback((_event: MouseEvent | TouchEvent, state: { readonly fromHandle?: { readonly id?: string | null; readonly nodeId: string; readonly type: string } | null; readonly isValid?: boolean | null; readonly toHandle?: { readonly id?: string | null; readonly nodeId: string; readonly type: string } | null }) => {
    const from = state.fromHandle ?? null;
    const to = state.toHandle ?? null;
    if (from === null || to === null) {
      setNotice('');
      return;
    }
    const output = from.type === 'source' ? from : to;
    const input = from.type === 'source' ? to : from;
    if (typeof output.id !== 'string' || typeof input.id !== 'string') return;
    const verdict = evaluateProtocolConnection(definition, {
      from: { nodeId: output.nodeId, port: output.id },
      to: { nodeId: input.nodeId, port: input.id },
    }, host.capabilities);
    setNotice(verdict.allowed || verdict.rejection === undefined ? '' : t(connectionRejectionKey(verdict.rejection)));
  }, [definition, host.capabilities, t]);

  const focusNode = useCallback((nodeId: string) => {
    const target = view.nodes.find((node) => node.id === nodeId);
    setSelectedNodeId(nodeId);
    if (target === undefined) return;
    void setCenter(target.x + PROTOCOL_NODE_CARD_WIDTH / 2, target.y + target.height / 2, { duration: 0, zoom: getZoom() });
  }, [getZoom, setCenter, view.nodes]);

  const addNode = useCallback((kind: ProtocolNodeKind) => {
    const id = nextNodeId(definition, kind);
    const point = nextFreePlacement([...positions.values()]);
    edit(addProtocolNode(definition, createEditorNode(kind, id, PHASE_FIVE_PROTOCOL_LIMITS)));
    setPositions((current) => new Map(current).set(id, point));
    setSelectedNodeId(id);
    setNotice('');
    // Yeni düğüm her zaman görünür alana gelir; yakınlaştırma seviyesi korunur.
    void setCenter(
      point.x + PROTOCOL_NODE_CARD_WIDTH / 2,
      point.y + nodeCardHeight(createEditorNode(kind, id, PHASE_FIVE_PROTOCOL_LIMITS)) / 2,
      { duration: 0, zoom: getZoom() },
    );
  }, [definition, edit, getZoom, positions, setCenter]);

  const deleteNode = useCallback((nodeId: string) => {
    setDraft((current) => editProtocolDraft(current, removeProtocolNode(current.definition, nodeId)));
    setResultOpen(false);
    setPositions((current) => {
      const next = new Map(current);
      next.delete(nodeId);
      return next;
    });
    setSelectedNodeId((current) => (current === nodeId ? null : current));
  }, []);

  const handleNodesDelete = useCallback((deleted: readonly { readonly id: string }[]) => {
    for (const node of deleted) deleteNode(node.id);
  }, [deleteNode]);

  const handleEdgesDelete = useCallback((deleted: readonly { readonly id: string }[]) => {
    setDraft((current) => editProtocolDraft(
      current,
      deleted.reduce<ProtocolDefinition>((next, edge) => disconnectProtocolEdge(next, edge.id), current.definition),
    ));
    setResultOpen(false);
  }, []);

  const changeNode = useCallback((node: ProtocolNode) => {
    edit(updateProtocolNode(definition, node));
  }, [definition, edit]);

  const check = useCallback(() => {
    setDraft((current) => checkProtocolDraft(current, host.readCapabilities()));
    setResultOpen(true);
    setNotice('');
  }, [host]);

  const applyDraft = useCallback(() => {
    const applied = appliedProtocol(definition);
    host.onApply(applied);
    setDraft((current) => Object.freeze({ ...current, definition: applied, dirty: false }));
    setNotice(t('protocolEditor.apply.done'));
  }, [definition, host, t]);

  const saveDraft = useCallback(() => {
    const saved = savedDraftProtocol(definition);
    host.onSaveDraft(saved);
    setDraft((current) => Object.freeze({ ...current, definition: saved, dirty: false }));
    setNotice(t('protocolEditor.apply.savedDraft'));
  }, [definition, host, t]);

  const selectedNode = definition.nodes.find((node) => node.id === selectedNodeId);
  const selectedView = view.nodes.find((node) => node.id === selectedNodeId);
  const applyBlock = protocolApplyBlock(draft);
  const counts = protocolFindingCounts(report);
  const listed = orderedFindings(report);
  const selectedFindings: readonly ProtocolValidationFinding[] = selectedNode === undefined
    ? []
    : listed.filter((finding) => finding.nodeId === selectedNode.id);

  return (
    <section aria-labelledby="protocol-editor-heading" className="protocol-editor" data-testid="protocol-editor">
      <header className="protocol-editor-bar">
        <div className="protocol-editor-identity">
          <Link className="protocol-editor-back" data-testid="protocol-editor-back" to="/protocols">
            {t('protocolEditor.back')}
          </Link>
          <h1 id="protocol-editor-heading">{definition.name}</h1>
          <span className="protocol-badge" data-lifecycle={definition.lifecycle}>
            {t(`protocolManager.lifecycle.${definition.lifecycle}`)}
          </span>
          {draft.dirty ? <span className="protocol-editor-dirty" data-testid="protocol-editor-dirty">{t('protocolEditor.unsaved')}</span> : null}
        </div>
        <div className="protocol-editor-viewport">
          <button data-testid="protocol-zoom-out" onClick={() => void zoomOut()} type="button">{t('protocolEditor.zoomOut')}</button>
          <span data-testid="protocol-zoom-level">{t('protocolEditor.zoomLevel', { percent: Math.round(zoom * 100) })}</span>
          <button data-testid="protocol-zoom-in" onClick={() => void zoomIn()} type="button">{t('protocolEditor.zoomIn')}</button>
          <button data-testid="protocol-fit-view" onClick={() => void fitView()} type="button">{t('protocolEditor.fitView')}</button>
        </div>
        <div className="protocol-editor-commit">
          <button className="protocol-editor-secondary" data-testid="protocol-save-draft" onClick={saveDraft} type="button">
            {t('protocolEditor.actions.saveDraft')}
          </button>
          <button className="protocol-editor-secondary" data-testid="protocol-check" onClick={check} type="button">
            {t('protocolEditor.actions.check')}
          </button>
          <button
            className="protocol-editor-primary"
            data-testid="protocol-apply"
            disabled={applyBlock !== undefined}
            onClick={applyDraft}
            title={applyBlock === undefined ? undefined : t(applyBlock === 'unchecked' ? 'protocolEditor.apply.blockedUnchecked' : 'protocolEditor.apply.blockedInvalid')}
            type="button"
          >
            {t('protocolEditor.actions.apply')}
          </button>
        </div>
      </header>

      <div className="protocol-editor-stage">
        <div aria-label={t('protocolEditor.canvasLabel')} className="protocol-editor-canvas" role="application">
          <ReactFlow
            deleteKeyCode={['Delete', 'Backspace']}
            edges={flowEdges}
            isValidConnection={isValidConnection}
            maxZoom={ZOOM_MAXIMUM}
            minZoom={ZOOM_MINIMUM}
            nodeTypes={NODE_TYPES}
            nodes={flowNodes}
            onConnect={handleConnect}
            onConnectEnd={handleConnectEnd}
            onEdgesDelete={handleEdgesDelete}
            onNodesChange={handleNodesChange}
            onNodesDelete={handleNodesDelete}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--protocol-canvas-dot)" gap={CANVAS_DOT_GAP} size={1.5} variant={BackgroundVariant.Dots} />
            {resultOpen && report !== undefined ? (
              <Panel position="top-center">
                <div
                  aria-live="polite"
                  className="protocol-check-result"
                  data-severity={counts.errors > 0 ? 'error' : counts.warnings > 0 ? 'warning' : 'clean'}
                  data-testid="protocol-check-result"
                  role="status"
                >
                  <p className="protocol-check-headline" data-testid="protocol-check-headline">
                    {counts.errors > 0
                      ? t('protocolEditor.check.problems', { count: counts.errors })
                      : counts.warnings > 0
                        ? `${t('protocolEditor.check.warnings', { count: counts.warnings })} · ${t('protocolEditor.check.warningsHint')}`
                        : t('protocolEditor.check.clean')}
                  </p>
                  <ul className="protocol-check-list">
                    {listed.slice(0, RESULT_FINDING_LIMIT).map((finding) => {
                      const anchor = finding.nodeId;
                      return (
                        <li data-severity={finding.severity} key={`${finding.code}|${finding.nodeId ?? ''}|${finding.edgeId ?? ''}`}>
                          <span>{t(finding.code)}</span>
                          {anchor === undefined ? null : (
                            <button className="protocol-check-focus" onClick={() => focusNode(anchor)} type="button">
                              {t('protocolEditor.check.focus')}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {listed.length > RESULT_FINDING_LIMIT
                    ? <p className="protocol-check-more">{t('protocolEditor.check.more', { count: listed.length - RESULT_FINDING_LIMIT })}</p>
                    : null}
                  <button className="protocol-check-dismiss" data-testid="protocol-check-dismiss" onClick={() => setResultOpen(false)} type="button">
                    {t('protocolEditor.check.dismiss')}
                  </button>
                </div>
              </Panel>
            ) : null}
            <Panel position="bottom-left">
              <div aria-label={t('protocolEditor.palette.title')} className="protocol-palette" data-testid="protocol-palette" role="group">
                <p className="protocol-palette-title">{t('protocolEditor.palette.title')}</p>
                {PROTOCOL_NODE_PALETTE.map((entry) => (
                  <button
                    className="protocol-palette-item"
                    data-kind={entry.kind}
                    data-testid={`protocol-palette-${entry.kind}`}
                    key={entry.kind}
                    onClick={() => addNode(entry.kind)}
                    type="button"
                  >
                    {t(entry.labelKey)}
                  </button>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>

        <aside aria-label={t('protocolEditor.detail.title')} className="protocol-editor-detail">
          <h2>{t('protocolEditor.detail.title')}</h2>
          {selectedNode === undefined || selectedView === undefined
            ? <p className="protocol-editor-detail-empty" data-testid="protocol-detail-empty">{t('protocolEditor.detail.empty')}</p>
            : (
              <ProtocolNodeSettings
                capabilities={host.capabilities}
                findings={selectedFindings}
                node={selectedNode}
                onChange={changeNode}
                onDelete={() => deleteNode(selectedNode.id)}
                summaryLines={selectedView.lines}
                t={t}
              />
            )}
        </aside>
      </div>

      <p aria-live="polite" className="protocol-editor-notice" data-testid="protocol-connection-notice" role="status">{notice}</p>
    </section>
  );
}

export function ProtocolGraphEditor({ host, protocol }: { readonly host: ProtocolEditorHost; readonly protocol: ProtocolDefinition }) {
  return (
    <ReactFlowProvider>
      <ProtocolGraphEditorSurface host={host} protocol={protocol} />
    </ReactFlowProvider>
  );
}
