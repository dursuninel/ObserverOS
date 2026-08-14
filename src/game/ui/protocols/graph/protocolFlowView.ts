import type {
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolEdge,
  ProtocolNodeKind,
} from '../../../domain/protocol/Protocol';
import { describeProtocolNode, type ProtocolTranslate } from '../protocolSummary';
import type { ProtocolCanvasPoint } from './protocolGraphLayout';
import {
  nodeCardHeight,
  nodeLabelKey,
  orderedInputPorts,
  orderedOutputPorts,
  portLabelKey,
} from './protocolNodePresentation';

/**
 * Canvas'ın çizeceği veri — React Flow'dan BAĞIMSIZ düz veri olarak üretilir.
 * Bileşen yalnız bu görünümü React Flow şekline çevirir; böylece kartın etiketleri,
 * port sırası ve kenar sınıfları başsız testte doğrulanabilir.
 */

export interface ProtocolFlowPortView {
  readonly label: string;
  readonly port: string;
}

export interface ProtocolFlowNodeView {
  readonly height: number;
  readonly id: string;
  readonly inputs: readonly ProtocolFlowPortView[];
  readonly kind: ProtocolNodeKind;
  readonly lines: readonly string[];
  readonly outputs: readonly ProtocolFlowPortView[];
  readonly typeLabel: string;
  readonly x: number;
  readonly y: number;
}

/** §11.1 kenar sınıfları: akış · evet · hayır · ölçüm. */
export const PROTOCOL_EDGE_CLASSES = ['flow', 'yes', 'no', 'value'] as const;
export type ProtocolEdgeClass = (typeof PROTOCOL_EDGE_CLASSES)[number];

export interface ProtocolFlowEdgeView {
  readonly edgeClass: ProtocolEdgeClass;
  readonly id: string;
  /** Yalnız Evet/Hayır kenarlarında; §25.2 gereği ayrım renkle değil metin+çizgiyle de taşınır. */
  readonly label?: string;
  readonly source: string;
  readonly sourceHandle: string;
  readonly target: string;
  readonly targetHandle: string;
}

export function edgeClassOf(edge: ProtocolEdge): ProtocolEdgeClass {
  if (edge.from.port === 'whenTrue') return 'yes';
  if (edge.from.port === 'whenFalse') return 'no';
  if (edge.from.port === 'value' || edge.from.port === 'result') return 'value';
  return 'flow';
}

function edgeLabelKey(edgeClass: ProtocolEdgeClass): string | undefined {
  if (edgeClass === 'yes') return 'protocolEditor.edge.yes';
  if (edgeClass === 'no') return 'protocolEditor.edge.no';
  return undefined;
}

export interface ProtocolFlowView {
  readonly edges: readonly ProtocolFlowEdgeView[];
  readonly nodes: readonly ProtocolFlowNodeView[];
}

export function buildProtocolFlowView(
  definition: ProtocolDefinition,
  positions: ReadonlyMap<string, ProtocolCanvasPoint>,
  t: ProtocolTranslate,
  capabilities?: ProtocolCapabilities,
): ProtocolFlowView {
  const nodes = definition.nodes.map((node) => {
    const point = positions.get(node.id) ?? { x: 0, y: 0 };
    return Object.freeze({
      height: nodeCardHeight(node, capabilities),
      id: node.id,
      inputs: Object.freeze(orderedInputPorts(node).map((port) => Object.freeze({ label: t(portLabelKey(port)), port }))),
      kind: node.kind,
      lines: describeProtocolNode(definition, node, t),
      outputs: Object.freeze(orderedOutputPorts(node, capabilities).map((port) => Object.freeze({ label: t(portLabelKey(port)), port }))),
      typeLabel: t(nodeLabelKey(node.kind)),
      x: point.x,
      y: point.y,
    });
  });

  const edges = definition.edges.map((edge) => {
    const edgeClass = edgeClassOf(edge);
    const labelKey = edgeLabelKey(edgeClass);
    return Object.freeze({
      edgeClass,
      id: edge.id,
      ...(labelKey === undefined ? {} : { label: t(labelKey) }),
      source: edge.from.nodeId,
      sourceHandle: edge.from.port,
      target: edge.to.nodeId,
      targetHandle: edge.to.port,
    });
  });

  return Object.freeze({ edges: Object.freeze(edges), nodes: Object.freeze(nodes) });
}
