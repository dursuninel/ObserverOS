import { PROTOCOL_NODE_KINDS, type ProtocolCapabilities, type ProtocolNode, type ProtocolNodeKind } from '../../../domain/protocol/Protocol';
import { protocolInputPorts, protocolOutputPorts } from '../../../simulation/protocol/protocolValidator';

/**
 * Node kartının ölçü ve etiket katmanı — `docs/design/faz6-protokol-duzenleyici.md`
 * §9 (kart), §10 (portlar) sayısal kararlarının kod karşılığı.
 *
 * Renk burada YOKTUR: kimlik rengi CSS'te `data-kind` üzerinden verilir (§9.4 —
 * kart iskeleti bütün türlerde aynıdır, tür ayrımı yalnız şerit + ikon + addır).
 * Port adları icat edilmez; şema Faz 5 doğrulayıcısından okunur.
 */

/** §9.1: bütün türlerde sabit genişlik. */
export const PROTOCOL_NODE_CARD_WIDTH = 192;
/** §9.1: başlık şeridi. */
export const PROTOCOL_NODE_HEADER_HEIGHT = 36;
/** §9.1: port satır aralığı. */
export const PROTOCOL_NODE_PORT_STEP = 26;
/** §4.1: özet satırı yüksekliği (13/18 px tipografi + 2 px). */
export const PROTOCOL_NODE_SUMMARY_STEP = 20;
/** Başlık altındaki boşluk + kartın alt iç boşluğu (§9.1, 8-grid). */
const BODY_TOP_GAP = 8;
const CARD_BOTTOM_PADDING = 14;

/**
 * §9.3 tür başına özet satırı sayısı — `describeProtocolNode` ile birebir aynıdır.
 *
 * Tasarım §9.1 yüksekliği `n = max(giriş, çıkış, özet)` ile hesaplıyor; bu formül
 * özet satırı ile port satırını AYNI banda koyduğu için metinler üst üste biniyordu
 * (ölçüldü: Karşılaştır kartında özet, "Evet/Hayır/Sonuç" etiketlerinin altına
 * giriyor). §9.2'nin sıralaması korunarak — başlık → özet → port satırları —
 * yükseklik `44 + özet×20 + satır×26 + 14` olarak hesaplanır. Genişlik, renk,
 * boşluk ve port ölçüleri tasarımdaki değerlerdir.
 */
export const PROTOCOL_NODE_SUMMARY_LINES: Readonly<Record<ProtocolNodeKind, number>> = Object.freeze({
  action: 2,
  and: 0,
  compare: 1,
  delay: 1,
  sensor: 1,
  trigger: 2,
});


export interface ProtocolPaletteEntry {
  readonly kind: ProtocolNodeKind;
  readonly labelKey: string;
}

/**
 * Düğüm paleti — **kapalı liste, tam olarak altı** (§9.3, spec satır 5446).
 * VEYA / DEĞİL / Sayaç / Splitter / Zamanlayıcı bu fazda yoktur ve palette görünmez.
 * Sıra kod modelindeki `PROTOCOL_NODE_KINDS` sırasıdır; ayrı bir sıralama tutulmaz.
 */
export const PROTOCOL_NODE_PALETTE: readonly ProtocolPaletteEntry[] = Object.freeze(
  PROTOCOL_NODE_KINDS.map((kind) => Object.freeze({ kind, labelKey: `protocolEditor.node.${kind}` })),
);

export function nodeLabelKey(kind: ProtocolNodeKind): string {
  return `protocolEditor.node.${kind}`;
}

export function nodeDescriptionKey(kind: ProtocolNodeKind): string {
  return `protocolEditor.nodeDescription.${kind}`;
}

/** §10.1: teknik port adı ekranda görünmez, sözlükten geçer. */
export function portLabelKey(port: string): string {
  return `protocolEditor.port.${port}`;
}

/** Port satırı sayısı: sol ve sağ sütunun uzun olanı. */
export function portRowCount(node: ProtocolNode, capabilities?: ProtocolCapabilities): number {
  return Math.max(orderedInputPorts(node).length, orderedOutputPorts(node, capabilities).length);
}

export function nodeCardHeight(node: ProtocolNode, capabilities?: ProtocolCapabilities): number {
  const summary = PROTOCOL_NODE_SUMMARY_LINES[node.kind] * PROTOCOL_NODE_SUMMARY_STEP;
  const ports = portRowCount(node, capabilities) * PROTOCOL_NODE_PORT_STEP;
  return PROTOCOL_NODE_HEADER_HEIGHT + BODY_TOP_GAP + summary + ports + CARD_BOTTOM_PADDING;
}

/** Port noktasının kart üstünden dikey uzaklığı; özet satırlarının altından başlar. */
export function portOffsetY(index: number, kind: ProtocolNodeKind): number {
  const summary = PROTOCOL_NODE_SUMMARY_LINES[kind] * PROTOCOL_NODE_SUMMARY_STEP;
  return PROTOCOL_NODE_HEADER_HEIGHT + BODY_TOP_GAP + summary + PROTOCOL_NODE_PORT_STEP / 2 + index * PROTOCOL_NODE_PORT_STEP;
}

/** Kart üzerinde yukarıdan aşağıya giriş noktaları (şema sırası korunur). */
export function orderedInputPorts(node: ProtocolNode): readonly string[] {
  return Object.freeze([...protocolInputPorts(node).keys()]);
}

/** Kart üzerinde yukarıdan aşağıya çıkış noktaları. */
export function orderedOutputPorts(node: ProtocolNode, capabilities?: ProtocolCapabilities): readonly string[] {
  return Object.freeze([...protocolOutputPorts(node, capabilities).keys()]);
}

