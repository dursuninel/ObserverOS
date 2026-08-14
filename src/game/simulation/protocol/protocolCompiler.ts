import type { Priority } from '../../domain/facilities/Facility';
import type {
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolNode,
  ProtocolNodeKind,
  ProtocolValidationReport,
} from '../../domain/protocol/Protocol';
import { validateProtocol } from './protocolValidator';

/**
 * Protocol compiler (spec §53.4).
 *
 * Graph'tan deterministic, düz ve editör alanı içermeyen bir çalıştırılabilir
 * temsil üretir. Sıralama Map/Set iteration'ına değil id'ye göre stable sort'a
 * dayanır; hash saf FNV-1a ile türetilir (saat veya rastgelelik kaynağı yoktur).
 * Yürütme semantiği (pulse akışı, delay zamanlaması) bu katmanda yoktur.
 */

export interface ExecutableProtocolEdge {
  readonly fromPort: string;
  readonly toNodeId: string;
  readonly toPort: string;
}

export interface ExecutableProtocolNode {
  readonly id: string;
  readonly kind: ProtocolNodeKind;
  /** Editör alanlarından arındırılmış node verisi. */
  readonly node: ProtocolNode;
  readonly outgoing: readonly ExecutableProtocolEdge[];
}

export interface ExecutableProtocol {
  readonly compiledHash: string;
  readonly id: string;
  /** Topolojik sırada, deterministic. */
  readonly nodes: readonly ExecutableProtocolNode[];
  readonly priority: Priority;
  readonly rootTriggerId: string;
  readonly version: number;
}

export type CompileResult =
  | { readonly protocol: ExecutableProtocol; readonly report: ProtocolValidationReport; readonly status: 'compiled' }
  | { readonly report: ProtocolValidationReport; readonly status: 'rejected' };

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function literalToken(value: boolean | number | string | undefined): string {
  if (value === undefined) return '-';
  if (typeof value === 'number') return `n${value.toString()}`;
  if (typeof value === 'boolean') return value ? 'b1' : 'b0';
  return `s${value}`;
}

/** Yalnız bilinen alanları kopyalar; position/selection/color gibi editör alanları taşınmaz. */
function sanitizeNode(node: ProtocolNode): ProtocolNode {
  switch (node.kind) {
    case 'trigger':
      return Object.freeze({
        ...(node.facilityId === undefined ? {} : { facilityId: node.facilityId }),
        id: node.id,
        kind: 'trigger' as const,
        operator: node.operator,
        sensorId: node.sensorId,
        threshold: node.threshold,
      });
    case 'sensor':
      return Object.freeze({
        ...(node.facilityId === undefined ? {} : { facilityId: node.facilityId }),
        id: node.id,
        kind: 'sensor' as const,
        sensorId: node.sensorId,
      });
    case 'compare':
      return Object.freeze({
        ...(node.comparand === undefined ? {} : { comparand: node.comparand }),
        id: node.id,
        kind: 'compare' as const,
        operator: node.operator,
      });
    case 'and':
      return Object.freeze({ id: node.id, kind: 'and' as const });
    case 'delay':
      return Object.freeze({ durationMinutes: node.durationMinutes, id: node.id, kind: 'delay' as const });
    case 'action':
      return Object.freeze({
        actionId: node.actionId,
        ...(node.facilityId === undefined ? {} : { facilityId: node.facilityId }),
        id: node.id,
        kind: 'action' as const,
        ...(node.value === undefined ? {} : { value: node.value }),
      });
  }
}

function nodeToken(node: ProtocolNode): string {
  switch (node.kind) {
    case 'trigger':
      return ['trigger', node.id, node.sensorId, node.facilityId ?? '-', node.operator, literalToken(node.threshold)].join(':');
    case 'sensor':
      return ['sensor', node.id, node.sensorId, node.facilityId ?? '-'].join(':');
    case 'compare':
      return ['compare', node.id, node.operator, literalToken(node.comparand)].join(':');
    case 'and':
      return ['and', node.id].join(':');
    case 'delay':
      return ['delay', node.id, node.durationMinutes.toString()].join(':');
    case 'action':
      return ['action', node.id, node.actionId, node.facilityId ?? '-', literalToken(node.value)].join(':');
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Kahn topolojik sıralama; hazır düğümler arasından her zaman en küçük id seçilir. */
function topologicalOrder(
  nodes: readonly ProtocolNode[],
  adjacency: ReadonlyMap<string, readonly string[]>,
): readonly ProtocolNode[] | undefined {
  const indegree = new Map<string, number>(nodes.map((node) => [node.id, 0] as const));
  for (const [, targets] of [...adjacency.entries()].sort((left, right) => compareStrings(left[0], right[0]))) {
    for (const target of targets) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  }

  const remaining = new Map(nodes.map((node) => [node.id, node] as const));
  const ordered: ProtocolNode[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.keys()].filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0).sort(compareStrings);
    const next = ready[0];
    if (next === undefined) return undefined;
    const node = remaining.get(next);
    if (node !== undefined) ordered.push(node);
    remaining.delete(next);
    for (const target of adjacency.get(next) ?? []) indegree.set(target, (indegree.get(target) ?? 0) - 1);
  }

  return ordered;
}

export function compileProtocol(
  definition: ProtocolDefinition,
  capabilities?: ProtocolCapabilities,
): CompileResult {
  const report = validateProtocol(definition, capabilities);
  if (!report.valid) return Object.freeze({ report, status: 'rejected' as const });

  const nodes = [...definition.nodes].sort((left, right) => compareStrings(left.id, right.id));
  const edges = [...definition.edges].sort((left, right) => compareStrings(
    [left.from.nodeId, left.from.port, left.to.nodeId, left.to.port].join('|'),
    [right.from.nodeId, right.from.port, right.to.nodeId, right.to.port].join('|'),
  ));

  const adjacency = new Map<string, string[]>(nodes.map((node) => [node.id, []] as const));
  const outgoing = new Map<string, ExecutableProtocolEdge[]>(nodes.map((node) => [node.id, []] as const));
  for (const edge of edges) {
    adjacency.get(edge.from.nodeId)?.push(edge.to.nodeId);
    outgoing.get(edge.from.nodeId)?.push(Object.freeze({ fromPort: edge.from.port, toNodeId: edge.to.nodeId, toPort: edge.to.port }));
  }

  const ordered = topologicalOrder(nodes, adjacency);
  const trigger = nodes.find((node) => node.kind === 'trigger');
  if (ordered === undefined || trigger === undefined) return Object.freeze({ report, status: 'rejected' as const });

  const executableNodes = ordered.map((node) => Object.freeze({
    id: node.id,
    kind: node.kind,
    node: sanitizeNode(node),
    outgoing: Object.freeze([...(outgoing.get(node.id) ?? [])]),
  }));

  const canonical = [
    ['protocol', definition.id, definition.version.toString(), definition.priority].join(':'),
    ...executableNodes.map((executable) => [
      nodeToken(executable.node),
      ...executable.outgoing.map((edge) => ['edge', edge.fromPort, edge.toNodeId, edge.toPort].join(':')),
    ].join('>')),
  ].join('\n');

  return Object.freeze({
    protocol: Object.freeze({
      compiledHash: fnv1a(canonical),
      id: definition.id,
      nodes: Object.freeze(executableNodes),
      priority: definition.priority,
      rootTriggerId: trigger.id,
      version: definition.version,
    }),
    report,
    status: 'compiled' as const,
  });
}
