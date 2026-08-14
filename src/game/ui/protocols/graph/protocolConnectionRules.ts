import type {
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolPortRef,
} from '../../../domain/protocol/Protocol';
import {
  arePortTypesCompatible,
  protocolInputPorts,
  protocolOutputPorts,
} from '../../../simulation/protocol/protocolValidator';

/**
 * Bağlantı kuralları (spec §14.2, satır 1057): geçersiz bağlantı **kurulamadan**
 * engellenir ve doğal Türkçe açıklama gösterilir.
 *
 * Port şeması ve tip uyumu burada yeniden tanımlanmaz; Faz 5 doğrulayıcısının
 * dışa açtığı `protocolInputPorts` / `protocolOutputPorts` / `arePortTypesCompatible`
 * çağrılır. Böylece "editörde kurulabilen ama doğrulamada hata veren bağlantı"
 * durumu yapısal olarak imkânsızdır.
 *
 * Bu modül saftır: React/React Flow bağımlılığı yoktur, tarayıcı API'si okumaz.
 */

export const PROTOCOL_CONNECTION_REJECTIONS = [
  'unknown-port',
  'self-connection',
  'direction',
  'type-mismatch',
  'input-occupied',
  'duplicate',
  'cycle',
] as const;
export type ProtocolConnectionRejection = (typeof PROTOCOL_CONNECTION_REJECTIONS)[number];

export interface ProtocolConnectionCandidate {
  readonly from: ProtocolPortRef;
  readonly to: ProtocolPortRef;
}

export interface ProtocolConnectionVerdict {
  readonly allowed: boolean;
  readonly rejection?: ProtocolConnectionRejection;
}

const ALLOWED: ProtocolConnectionVerdict = Object.freeze({ allowed: true });

function rejected(rejection: ProtocolConnectionRejection): ProtocolConnectionVerdict {
  return Object.freeze({ allowed: false, rejection });
}

/** Bulgu metinleri koda gömülmez; kod → localization anahtarı. */
export function connectionRejectionKey(rejection: ProtocolConnectionRejection): string {
  return `protocolEditor.connection.${rejection}`;
}

function samePort(left: ProtocolPortRef, right: ProtocolPortRef): boolean {
  return left.nodeId === right.nodeId && left.port === right.port;
}

/** `to` düğümünden başlayarak `target` düğümüne ulaşılabiliyor mu (döngü önlemesi). */
function reaches(definition: ProtocolDefinition, start: string, target: string): boolean {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of definition.edges) {
      if (edge.from.nodeId === current) queue.push(edge.to.nodeId);
    }
  }
  return false;
}

/**
 * Bir bağlantı kurulabilir mi? Kurulamıyorsa gerekçe kodu döner.
 *
 * Sıralama bilinçlidir: önce yapısal imkânsızlıklar (yok olan uç, kendine bağlantı,
 * yön), sonra tip uyumu, sonra graph düzeyindeki kurallar (dolu giriş, tekrar, döngü).
 */
export function evaluateProtocolConnection(
  definition: ProtocolDefinition,
  candidate: ProtocolConnectionCandidate,
  capabilities?: ProtocolCapabilities,
): ProtocolConnectionVerdict {
  const source = definition.nodes.find((node) => node.id === candidate.from.nodeId);
  const target = definition.nodes.find((node) => node.id === candidate.to.nodeId);
  if (source === undefined || target === undefined) return rejected('unknown-port');

  if (source.id === target.id) return rejected('self-connection');

  const sourceType = protocolOutputPorts(source, capabilities).get(candidate.from.port);
  const targetType = protocolInputPorts(target).get(candidate.to.port);

  // Çıkış olmayan bir uçtan başlanmış ya da giriş olmayan bir uca bırakılmışsa: yön hatası.
  if (sourceType === undefined || targetType === undefined) {
    const sourceIsInput = protocolInputPorts(source).has(candidate.from.port);
    const targetIsOutput = protocolOutputPorts(target, capabilities).has(candidate.to.port);
    return rejected(sourceIsInput || targetIsOutput ? 'direction' : 'unknown-port');
  }

  if (!arePortTypesCompatible(sourceType, targetType)) return rejected('type-mismatch');

  for (const edge of definition.edges) {
    if (samePort(edge.from, candidate.from) && samePort(edge.to, candidate.to)) return rejected('duplicate');
    // Bir giriş noktası tek kaynaktan beslenir: runtime ikinci kaynağı zaten okumaz.
    if (samePort(edge.to, candidate.to)) return rejected('input-occupied');
  }

  if (reaches(definition, candidate.to.nodeId, candidate.from.nodeId)) return rejected('cycle');

  return ALLOWED;
}

/**
 * Sürükleme sırasında vurgulanacak uçlar (§10.2: uyumsuz noktalar sönümlenir).
 * Dönen liste id sırasına göre stable'dır.
 */
export function connectableTargetPorts(
  definition: ProtocolDefinition,
  from: ProtocolPortRef,
  capabilities?: ProtocolCapabilities,
): readonly ProtocolPortRef[] {
  const targets: ProtocolPortRef[] = [];
  for (const node of [...definition.nodes].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))) {
    for (const port of [...protocolInputPorts(node).keys()].sort()) {
      const candidate: ProtocolConnectionCandidate = { from, to: { nodeId: node.id, port } };
      if (evaluateProtocolConnection(definition, candidate, capabilities).allowed) {
        targets.push(Object.freeze({ nodeId: node.id, port }));
      }
    }
  }
  return Object.freeze(targets);
}
