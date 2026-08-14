import type {
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolNode,
  ProtocolNodeKind,
  ProtocolValidationLimits,
} from '../../../domain/protocol/Protocol';
import { protocolInputPorts, protocolOutputPorts } from '../../../simulation/protocol/protocolValidator';
import {
  evaluateProtocolConnection,
  type ProtocolConnectionCandidate,
  type ProtocolConnectionVerdict,
} from './protocolConnectionRules';

/**
 * Düzenleyicinin graph düzenleme işlemleri — hepsi SAF: girdi tanımı değişmez,
 * yeni bir `ProtocolDefinition` döner.
 *
 * Burada apply/kaydetme YOKTUR: düzenleyici protokolün çalışma kopyası üzerinde
 * çalışır, simülasyona yazma Faz 6/3'ün draft/apply akışına aittir. Bu yüzden hiçbir
 * fonksiyon store'a dokunmaz.
 */

/** Henüz seçilmemiş ölçüm/eylem kimliği; kart ve panel bunu "seçilmedi" olarak gösterir. */
export const PROTOCOL_UNSET_REFERENCE = '';

/** İlk boş sıra numarası: aynı graph + aynı tür her zaman aynı kimliği üretir. */
function nextSequence(existing: readonly string[], prefix: string): string {
  let index = 1;
  while (existing.includes(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export function nextNodeId(definition: ProtocolDefinition, kind: ProtocolNodeKind): string {
  return nextSequence(definition.nodes.map((node) => node.id), `${kind}-`);
}

export function nextEdgeId(definition: ProtocolDefinition): string {
  return nextSequence(definition.edges.map((edge) => edge.id), 'edge-');
}

/**
 * Paletten eklenen düğümün başlangıç hali.
 *
 * Ölçüm/eylem kimliği UYDURULMAZ (§72.6 satır 5448): boş bırakılır, oyuncu sağ panelden
 * seçer. Gecikme süresi sabit yazılmaz, `ProtocolValidationLimits` alt sınırından gelir.
 */
export function createEditorNode(
  kind: ProtocolNodeKind,
  id: string,
  limits: ProtocolValidationLimits,
): ProtocolNode {
  switch (kind) {
    case 'trigger':
      return Object.freeze({ id, kind, operator: '<', sensorId: PROTOCOL_UNSET_REFERENCE, threshold: 0 });
    case 'sensor':
      return Object.freeze({ id, kind, sensorId: PROTOCOL_UNSET_REFERENCE });
    case 'compare':
      return Object.freeze({ comparand: 0, id, kind, operator: '<' });
    case 'and':
      return Object.freeze({ id, kind });
    case 'delay':
      return Object.freeze({ durationMinutes: limits.delayMinimumMinutes, id, kind });
    case 'action':
      return Object.freeze({ actionId: PROTOCOL_UNSET_REFERENCE, id, kind });
  }
}

export function addProtocolNode(definition: ProtocolDefinition, node: ProtocolNode): ProtocolDefinition {
  return Object.freeze({ ...definition, nodes: Object.freeze([...definition.nodes, node]) });
}

/**
 * Bir düğümün alanlarını değiştirir.
 *
 * Düğümün bağlantı noktası şeması alanlara bağlı olabildiği için (Karşılaştır'ın
 * `İkinci değer` girişi sabit değer seçilince kaybolur) artık var olmayan uçlara
 * bağlı kenarlar da düşer — aksi hâlde düzenleyicide kurulamayan bir kenar
 * doğrulamada `edge-port-incompatible` olarak geri gelirdi.
 */
export function updateProtocolNode(definition: ProtocolDefinition, node: ProtocolNode): ProtocolDefinition {
  const inputs = protocolInputPorts(node);
  const outputs = protocolOutputPorts(node);
  return Object.freeze({
    ...definition,
    edges: Object.freeze(definition.edges.filter((edge) =>
      (edge.to.nodeId !== node.id || inputs.has(edge.to.port))
      && (edge.from.nodeId !== node.id || outputs.has(edge.from.port)))),
    nodes: Object.freeze(definition.nodes.map((entry) => (entry.id === node.id ? node : entry))),
  });
}

/** Düğüm silinince ona bağlı bütün bağlantılar da düşer; yetim kenar kalmaz. */
export function removeProtocolNode(definition: ProtocolDefinition, nodeId: string): ProtocolDefinition {
  return Object.freeze({
    ...definition,
    edges: Object.freeze(definition.edges.filter((edge) => edge.from.nodeId !== nodeId && edge.to.nodeId !== nodeId)),
    nodes: Object.freeze(definition.nodes.filter((node) => node.id !== nodeId)),
  });
}

export interface ProtocolConnectionResult {
  readonly definition: ProtocolDefinition;
  readonly verdict: ProtocolConnectionVerdict;
}

/**
 * Bağlantı kurma denemesi. Kural ihlalinde tanım DEĞİŞMEZ ve gerekçe döner —
 * spec §14.2 satır 1057: geçersiz bağlantı kurulamadan engellenir.
 */
export function connectProtocolNodes(
  definition: ProtocolDefinition,
  candidate: ProtocolConnectionCandidate,
  capabilities?: ProtocolCapabilities,
): ProtocolConnectionResult {
  const verdict = evaluateProtocolConnection(definition, candidate, capabilities);
  if (!verdict.allowed) return { definition, verdict };
  const edge = Object.freeze({
    from: Object.freeze({ ...candidate.from }),
    id: nextEdgeId(definition),
    to: Object.freeze({ ...candidate.to }),
  });
  return {
    definition: Object.freeze({ ...definition, edges: Object.freeze([...definition.edges, edge]) }),
    verdict,
  };
}

export function disconnectProtocolEdge(definition: ProtocolDefinition, edgeId: string): ProtocolDefinition {
  return Object.freeze({ ...definition, edges: Object.freeze(definition.edges.filter((edge) => edge.id !== edgeId)) });
}
