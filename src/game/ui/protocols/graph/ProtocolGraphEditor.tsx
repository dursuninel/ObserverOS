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

import type { ProtocolDefinition, ProtocolNodeKind } from '../../../domain/protocol/Protocol';
import { PHASE_FIVE_PROTOCOL_LIMITS } from '../../../simulation/SimulationConfig';
import type { ProtocolTranslate } from '../protocolSummary';
import { ProtocolNodeCard, type ProtocolFlowNode } from './ProtocolNodeCard';
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
} from './protocolEditorModel';
import { buildProtocolFlowView } from './protocolFlowView';
import { layoutProtocolGraph, nextFreePlacement, type ProtocolCanvasPoint } from './protocolGraphLayout';
import {
  PROTOCOL_NODE_CARD_WIDTH,
  PROTOCOL_NODE_PALETTE,
  nodeCardHeight,
  nodeDescriptionKey,
  nodeLabelKey,
} from './protocolNodePresentation';

/**
 * Graph Editor (spec §14.2): düğüm paleti + canvas + bağlantı kuralları.
 *
 * Düzenleme protokolün ÇALIŞMA KOPYASI üzerinde yapılır; hiçbir değişiklik burada
 * simülasyona veya store'a yazılmaz — draft/apply akışı Faz 6/3'e aittir (§53.2 sırası).
 * Geçersiz bağlantı KURULAMADAN engellenir ve gerekçesi doğal Türkçe olarak duyurulur
 * (satır 1057); kural motoru Faz 5 doğrulayıcısının port şemasını çağırır.
 */

const NODE_TYPES: NodeTypes = { protocolNode: ProtocolNodeCard };

const ZOOM_MINIMUM = 0.4;
const ZOOM_MAXIMUM = 1.6;
/** §8: 24 px aralıklı nokta ızgara. */
const CANVAS_DOT_GAP = 24;

function initialPositions(definition: ProtocolDefinition): ReadonlyMap<string, ProtocolCanvasPoint> {
  return new Map(layoutProtocolGraph(definition).map((placement) => [placement.nodeId, { x: placement.x, y: placement.y }]));
}

function ProtocolGraphEditorSurface({ protocol }: { readonly protocol: ProtocolDefinition }) {
  const { t: translate } = useTranslation();
  const t = translate as ProtocolTranslate;
  const { fitView, getZoom, setCenter, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();

  const [definition, setDefinition] = useState<ProtocolDefinition>(protocol);
  const [positions, setPositions] = useState<ReadonlyMap<string, ProtocolCanvasPoint>>(() => initialPositions(protocol));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('');

  const view = useMemo(() => buildProtocolFlowView(definition, positions, t), [definition, positions, t]);

  const flowNodes = useMemo<ProtocolFlowNode[]>(() => view.nodes.map((node) => ({
    data: {
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
  })), [selectedNodeId, view.nodes]);

  const flowEdges = useMemo<Edge[]>(() => view.edges.map((edge) => ({
    className: `protocol-edge protocol-edge-${edge.edgeClass}`,
    id: edge.id,
    ...(edge.label === undefined ? {} : { label: edge.label }),
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle,
  })), [view.edges]);

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
    const result = connectProtocolNodes(definition, candidate);
    setDefinition(result.definition);
    setNotice(result.verdict.rejection === undefined ? '' : t(connectionRejectionKey(result.verdict.rejection)));
  }, [candidateOf, definition, t]);

  /** React Flow bu `false` dönerse bağlantıyı KURMAZ — engelleme burada olur. */
  const isValidConnection = useCallback((connection: Connection | Edge): boolean => {
    const candidate = candidateOf(connection);
    if (candidate === undefined) return false;
    return evaluateProtocolConnection(definition, candidate).allowed;
  }, [candidateOf, definition]);

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
    });
    setNotice(verdict.allowed || verdict.rejection === undefined ? '' : t(connectionRejectionKey(verdict.rejection)));
  }, [definition, t]);

  const addNode = useCallback((kind: ProtocolNodeKind) => {
    const id = nextNodeId(definition, kind);
    const point = nextFreePlacement([...positions.values()]);
    setDefinition((current) => addProtocolNode(current, createEditorNode(kind, id, PHASE_FIVE_PROTOCOL_LIMITS)));
    setPositions((current) => new Map(current).set(id, point));
    setSelectedNodeId(id);
    setNotice('');
    // Yeni düğüm her zaman görünür alana gelir; yakınlaştırma seviyesi korunur.
    void setCenter(
      point.x + PROTOCOL_NODE_CARD_WIDTH / 2,
      point.y + nodeCardHeight(createEditorNode(kind, id, PHASE_FIVE_PROTOCOL_LIMITS)) / 2,
      { duration: 0, zoom: getZoom() },
    );
  }, [definition, getZoom, positions, setCenter]);

  const deleteNode = useCallback((nodeId: string) => {
    setDefinition((current) => removeProtocolNode(current, nodeId));
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
    setDefinition((current) => deleted.reduce<ProtocolDefinition>((next, edge) => disconnectProtocolEdge(next, edge.id), current));
  }, []);

  const selectedNode = definition.nodes.find((node) => node.id === selectedNodeId);
  const selectedView = view.nodes.find((node) => node.id === selectedNodeId);

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
        </div>
        <div className="protocol-editor-viewport">
          <button data-testid="protocol-zoom-out" onClick={() => void zoomOut()} type="button">{t('protocolEditor.zoomOut')}</button>
          <span data-testid="protocol-zoom-level">{t('protocolEditor.zoomLevel', { percent: Math.round(zoom * 100) })}</span>
          <button data-testid="protocol-zoom-in" onClick={() => void zoomIn()} type="button">{t('protocolEditor.zoomIn')}</button>
          <button data-testid="protocol-fit-view" onClick={() => void fitView()} type="button">{t('protocolEditor.fitView')}</button>
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
              <div data-testid="protocol-detail">
                <p className="protocol-editor-detail-type" data-testid="protocol-detail-type">{t(nodeLabelKey(selectedNode.kind))}</p>
                <p className="protocol-editor-detail-description">{t(nodeDescriptionKey(selectedNode.kind))}</p>
                {selectedView.lines.map((line) => <p className="protocol-editor-detail-line" key={line}>{line}</p>)}
                <button
                  className="protocol-editor-delete"
                  data-testid="protocol-detail-delete"
                  onClick={() => deleteNode(selectedNode.id)}
                  type="button"
                >
                  {t('protocolEditor.detail.delete')}
                </button>
              </div>
            )}
        </aside>
      </div>

      <p aria-live="polite" className="protocol-editor-notice" data-testid="protocol-connection-notice" role="status">{notice}</p>
    </section>
  );
}

export function ProtocolGraphEditor({ protocol }: { readonly protocol: ProtocolDefinition }) {
  return (
    <ReactFlowProvider>
      <ProtocolGraphEditorSurface protocol={protocol} />
    </ReactFlowProvider>
  );
}
