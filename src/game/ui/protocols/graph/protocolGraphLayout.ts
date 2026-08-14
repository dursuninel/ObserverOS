import type { ProtocolDefinition, ProtocolNodeKind } from '../../../domain/protocol/Protocol';
import { PROTOCOL_NODE_CARD_WIDTH, nodeCardHeight } from './protocolNodePresentation';

/**
 * Graph yerleşimi (§53.4): node konumu protokol veri modelinde TUTULMAZ, her açılışta
 * graph'tan türetilir. Bu yüzden yerleşim DETERMİNİSTİK olmak zorundadır — aynı
 * protokol her zaman aynı konumları verir; rastgelelik veya saat okuması yoktur.
 *
 * Algoritma: akış yönünde katman (sütun) ataması + katman içinde id sırasına göre
 * dikey yığma. Döngülü graph'ta da sonlanır (ziyaret kümesi ile derinlik kilitlenir).
 */

/** §8: node'lar canvas kenarına 32 px'ten yakın konumlanamaz. */
export const PROTOCOL_LAYOUT_MARGIN = 32;
/** Sütun aralığı: kart genişliği + kenarların rahat okunduğu 96 px boşluk (§5.2 ölçü kontrolü). */
export const PROTOCOL_LAYOUT_COLUMN_GAP = 96;
export const PROTOCOL_LAYOUT_ROW_GAP = 40;

export interface ProtocolNodePlacement {
  readonly height: number;
  readonly kind: ProtocolNodeKind;
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
}

function byId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Her node'un akış yönündeki katmanı: girişi olmayan node'lar 0. katmandadır. */
function assignDepths(definition: ProtocolDefinition): ReadonlyMap<string, number> {
  const depths = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const node of definition.nodes) incoming.set(node.id, 0);
  for (const edge of definition.edges) {
    if (!incoming.has(edge.to.nodeId) || !incoming.has(edge.from.nodeId)) continue;
    incoming.set(edge.to.nodeId, (incoming.get(edge.to.nodeId) ?? 0) + 1);
  }

  const roots = [...definition.nodes]
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
    .sort(byId);

  // Kaynağı olmayan graph (yalnız döngü) da yerleşmelidir: id sırası ilk node'u kök sayar.
  const seeds = roots.length > 0 ? roots : [...definition.nodes].map((node) => node.id).sort(byId).slice(0, 1);
  for (const nodeId of seeds) depths.set(nodeId, 0);

  const queue = [...seeds];
  const settled = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (settled.has(current)) continue;
    settled.add(current);
    const depth = depths.get(current) ?? 0;
    for (const edge of definition.edges) {
      if (edge.from.nodeId !== current) continue;
      const next = edge.to.nodeId;
      const known = depths.get(next);
      if (known === undefined || known < depth + 1) depths.set(next, depth + 1);
      if (!settled.has(next)) queue.push(next);
    }
  }

  // Hiçbir kenardan erişilemeyen node'lar (kopuk parçalar) son sütuna değil, 0. sütuna düşer.
  for (const node of definition.nodes) if (!depths.has(node.id)) depths.set(node.id, 0);
  return depths;
}

export function layoutProtocolGraph(definition: ProtocolDefinition): readonly ProtocolNodePlacement[] {
  const depths = assignDepths(definition);
  const columns = new Map<number, string[]>();
  for (const node of [...definition.nodes].sort((left, right) => byId(left.id, right.id))) {
    const depth = depths.get(node.id) ?? 0;
    const column = columns.get(depth);
    if (column === undefined) columns.set(depth, [node.id]);
    else column.push(node.id);
  }

  const nodeById = new Map(definition.nodes.map((node) => [node.id, node] as const));
  const placements: ProtocolNodePlacement[] = [];
  for (const [depth, nodeIds] of [...columns.entries()].sort((left, right) => left[0] - right[0])) {
    let y = PROTOCOL_LAYOUT_MARGIN;
    for (const nodeId of nodeIds) {
      const node = nodeById.get(nodeId);
      if (node === undefined) continue;
      const height = nodeCardHeight(node);
      placements.push(Object.freeze({
        height,
        kind: node.kind,
        nodeId,
        x: PROTOCOL_LAYOUT_MARGIN + depth * (PROTOCOL_NODE_CARD_WIDTH + PROTOCOL_LAYOUT_COLUMN_GAP),
        y,
      }));
      y += height + PROTOCOL_LAYOUT_ROW_GAP;
    }
  }
  return Object.freeze(placements);
}

export interface ProtocolCanvasPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Paletten eklenen düğümün konumu: mevcut en sağdaki kartın sağına, boş bir sütuna.
 *
 * Konumlar canvas'ta kullanıcı tarafından sürüklenebildiği için yerleşim yeniden
 * hesaplanmaz; yeni düğüm var olan konumlara BAKARAK yerleştirilir. Aynı girdi her
 * zaman aynı noktayı verir.
 */
export function nextFreePlacement(current: readonly ProtocolCanvasPoint[]): ProtocolCanvasPoint {
  if (current.length === 0) return Object.freeze({ x: PROTOCOL_LAYOUT_MARGIN, y: PROTOCOL_LAYOUT_MARGIN });
  const x = Math.max(...current.map((point) => point.x)) + PROTOCOL_NODE_CARD_WIDTH + PROTOCOL_LAYOUT_COLUMN_GAP;
  return Object.freeze({ x, y: PROTOCOL_LAYOUT_MARGIN });
}
