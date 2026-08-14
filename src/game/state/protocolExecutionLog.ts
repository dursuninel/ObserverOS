import type { ProtocolCommandOutcome, ProtocolCommandStatus, ProtocolExecutionTrace } from '../domain/protocol/Protocol';

/**
 * Kartın "son çalışma durumu/zamanı" alanı için UI tarafı kayıt defteri (spec §14.1).
 *
 * Simülasyon yetkili katmanı bir protokolün "son durumunu" saklamaz: `SimulationEngine`
 * her fixed step'te o adımın command outcome'larını verir, execution trace'ler ise
 * birikir. Bu modül o iki kaynağı protokol başına TEK bir son-kayda indirger.
 * Saf fonksiyondur; saat okumaz, simTime dışında zaman kaynağı kullanmaz.
 */

/** `triggered`: execution başladı fakat henüz bir komut sonucu üretmedi (ör. Delay bekliyor). */
export type ProtocolExecutionStatus = ProtocolCommandStatus | 'triggered';

export interface ProtocolExecutionRecord {
  readonly protocolExecutionId: string;
  readonly simTime: number;
  readonly status: ProtocolExecutionStatus;
}

export type ProtocolExecutionLog = Readonly<Record<string, ProtocolExecutionRecord>>;

export const EMPTY_PROTOCOL_EXECUTION_LOG: ProtocolExecutionLog = Object.freeze({});

/**
 * Trace'ler protokolün ÇALIŞTIĞINI, outcome'lar komutun NE OLDUĞUNU söyler.
 * Aynı sim. dakikasında ikisi de varsa outcome kazanır: o daha kesin bir sonuçtur.
 */
export function reduceProtocolExecutionLog(
  previous: ProtocolExecutionLog,
  traces: readonly ProtocolExecutionTrace[],
  outcomes: readonly ProtocolCommandOutcome[],
): ProtocolExecutionLog {
  const next: Record<string, ProtocolExecutionRecord> = { ...previous };

  for (const trace of traces) {
    const current = next[trace.protocolId];
    if (current !== undefined && trace.triggeredAt <= current.simTime) continue;
    next[trace.protocolId] = Object.freeze({
      protocolExecutionId: trace.protocolExecutionId,
      simTime: trace.triggeredAt,
      status: 'triggered',
    });
  }

  for (const outcome of outcomes) {
    const current = next[outcome.protocolId];
    if (current !== undefined && outcome.simTime < current.simTime) continue;
    next[outcome.protocolId] = Object.freeze({
      protocolExecutionId: outcome.protocolExecutionId,
      simTime: outcome.simTime,
      status: outcome.status,
    });
  }

  return Object.freeze(next);
}
