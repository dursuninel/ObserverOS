import {
  FACILITY_ACTUATORS,
  PRIORITIES,
  type FacilityActuator,
  type FacilityCommandRequest,
  type FacilityDefinition,
  type FacilityInstanceState,
  type Priority,
  type SafetyInterlock,
} from '../../domain/facilities/Facility';
import type {
  ProtocolActionRequest,
  ProtocolCommandOutcome,
  ProtocolCommandReasonCode,
  ProtocolLiteral,
} from '../../domain/protocol/Protocol';

/**
 * Command arbitration (spec §13.10, §53.6, §53.7).
 *
 * Bu katman SAF karar katmanıdır: tesis state'ini DEĞİŞTİRMEZ, yalnız "hangi
 * komut uygulanacak, hangisi neden uygulanmayacak" planını üretir. Uygulama
 * `applyFacilityCommand` ile çağıran tarafta yapılır (§13.4: sonuç kalıcıdır,
 * geri alma mekanizması YOKTUR).
 *
 * §53.6 MUST: karar, o tick'teki TÜM request'ler toplandıktan SONRA verilir.
 * Değerlendirme sırası sonucu belirlemez — "ilk çalışan kazanır" yoktur.
 */

/** Action capability kimliğinin çözüldüğü tesis actuator'ü. */
export interface ProtocolActuatorBinding {
  readonly actuator: FacilityActuator;
  /** `set-setpoint` için ZORUNLU; §13.10 çakışma anahtarı setpoint bazındadır. */
  readonly setpointKey?: string;
}

/**
 * Capability → actuator çözümü data-driven'dır: hangi action id'sinin hangi
 * actuator'e karşılık geldiği çağırandan gelir, buraya gömülmez (§12).
 */
export type ProtocolActuatorResolver = (request: ProtocolActionRequest) => ProtocolActuatorBinding | undefined;

export interface ProtocolArbitrationInput {
  readonly definitions: ReadonlyMap<string, FacilityDefinition>;
  /** Arbitration ÖNCESİ tesis state'leri; bütün kararlar bu tek görünüme bakar. */
  readonly facilities: ReadonlyMap<string, FacilityInstanceState>;
  readonly interlock: SafetyInterlock;
  readonly requests: readonly ProtocolActionRequest[];
  readonly resolveActuator: ProtocolActuatorResolver;
}

export interface ProtocolPlannedCommand {
  readonly command: FacilityCommandRequest;
  /** Bu tek komutla karşılanan istekler; hepsi AYNI değeri istemiştir. */
  readonly requests: readonly ProtocolActionRequest[];
  readonly setpointKey?: string;
}

/** §13.10(3): eşit priority + uyumsuz komut → hiçbiri uygulanmaz, CONFLICT doğar. */
export interface ProtocolCommandConflict {
  readonly actuator: FacilityActuator;
  readonly facilityId: string;
  readonly priority: Priority;
  readonly protocolExecutionIds: readonly string[];
  readonly protocolIds: readonly string[];
  readonly requestedValues: readonly (ProtocolLiteral | undefined)[];
  readonly setpointKey?: string;
  readonly simTime: number;
}

export interface ProtocolArbitrationPlan {
  readonly commands: readonly ProtocolPlannedCommand[];
  readonly conflicts: readonly ProtocolCommandConflict[];
  /** Uygulanmayacağı arbitration aşamasında belli olan istekler (§13.11). */
  readonly rejections: readonly ProtocolCommandOutcome[];
}

/**
 * Facility katmanının ham reason code'u → §53.8 protokol sözlüğü. Tablo dışı bir
 * kod gelirse çevrilmez ama KAYBOLMAZ: outcome'da `facilityReasonCode` durur.
 */
const FACILITY_REASON_CODES: Readonly<Record<string, ProtocolCommandReasonCode>> = Object.freeze({
  'facility.condition-blocks-boost': 'SAFETY_CONDITION_LIMIT',
  'facility.condition-invalid': 'COMMAND_VALUE_INVALID',
  'facility.failed': 'TARGET_FAILED',
  'facility.maintenance-active': 'TARGET_MAINTENANCE',
  'facility.mode-unsupported': 'COMMAND_VALUE_UNSUPPORTED',
  'facility.not-found': 'TARGET_NOT_FOUND',
  'facility.priority-invalid': 'COMMAND_VALUE_INVALID',
  'facility.ramp-config-required': 'SAFETY_RAMP_REQUIRED',
  'facility.safety-interlocked': 'SAFETY_INTERLOCK_ACTIVE',
  'facility.setpoint-invalid': 'COMMAND_VALUE_INVALID',
  'facility.state-target-unsupported': 'COMMAND_VALUE_UNSUPPORTED',
  'facility.workforce-blocks-boost': 'SAFETY_WORKFORCE_MINIMUM',
});

interface ArbitrationEntry {
  readonly binding: ProtocolActuatorBinding;
  readonly facilityId: string;
  readonly request: ProtocolActionRequest;
}

/**
 * Varsayılan çözüm: action capability kimliği zaten bir tesis actuator'ü ise
 * birebir bağlanır. Kanonik bir action kataloğu UYDURULMAZ; başka bir kimlik
 * (ör. bir setpoint adı) için çağıran kendi resolver'ını verir.
 */
export const identityActuatorResolver: ProtocolActuatorResolver = (request) => {
  const actuator = FACILITY_ACTUATORS.find((candidate) => candidate === request.actuator);
  return actuator === undefined ? undefined : { actuator };
};

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareEntries(left: ArbitrationEntry, right: ArbitrationEntry): number {
  return compareStrings(left.request.protocolId, right.request.protocolId)
    || compareStrings(left.request.protocolExecutionId, right.request.protocolExecutionId);
}

/** §13.10(2) sıralaması: critical > high > normal > low. */
function priorityRank(priority: Priority): number {
  return PRIORITIES.indexOf(priority);
}

/**
 * §13.10(3) uyumluluk kararı: aynı actuator/setpoint'e AYNI değeri isteyen iki
 * komut uyumsuz DEĞİLDİR — çakışma sayılmaz, tek komut olarak uygulanır.
 * Uyumsuzluk yalnız FARKLI değer istendiğinde vardır.
 */
function distinctValues(entries: readonly ArbitrationEntry[]): readonly (ProtocolLiteral | undefined)[] {
  const values: (ProtocolLiteral | undefined)[] = [];
  for (const entry of entries) if (!values.some((value) => value === entry.request.value)) values.push(entry.request.value);
  return values;
}

/** §13.10 çakışma anahtarı: aynı tesis + aynı actuator (+ aynı setpoint). */
function groupKey(facilityId: string, binding: ProtocolActuatorBinding): string {
  return [facilityId, binding.actuator, binding.setpointKey ?? ''].join('|');
}

/** Deterministic ve iz sürülebilir komut kimliği; sayaç/rastgelelik kullanmaz. */
function commandId(request: ProtocolActionRequest, facilityId: string, binding: ProtocolActuatorBinding): string {
  const suffix = binding.setpointKey === undefined ? '' : `::${binding.setpointKey}`;
  return `protocol-command::${request.protocolExecutionId}::${facilityId}::${binding.actuator}${suffix}`;
}

function toFacilityCommand(
  request: ProtocolActionRequest,
  facilityId: string,
  binding: ProtocolActuatorBinding,
): FacilityCommandRequest {
  return Object.freeze({
    actuator: binding.actuator,
    facilityId,
    id: commandId(request, facilityId, binding),
    priority: request.priority,
    simTime: request.simTime,
    value: binding.actuator === 'set-setpoint'
      ? Object.freeze({ key: binding.setpointKey, value: request.value })
      : request.value,
  });
}

/** §13.11: her Action tam olarak bir sonuç üretir — uygulanmasa bile. */
export function protocolCommandOutcome(
  request: ProtocolActionRequest,
  binding: ProtocolActuatorBinding | undefined,
  status: ProtocolCommandOutcome['status'],
  reason: { readonly facilityReasonCode?: string; readonly reasonCode?: ProtocolCommandReasonCode },
  appliedValue?: unknown,
): ProtocolCommandOutcome {
  return Object.freeze({
    actuator: request.actuator,
    ...(appliedValue === undefined ? {} : { appliedValue }),
    ...(request.facilityId === undefined ? {} : { facilityId: request.facilityId }),
    ...(reason.facilityReasonCode === undefined ? {} : { facilityReasonCode: reason.facilityReasonCode }),
    protocolExecutionId: request.protocolExecutionId,
    protocolId: request.protocolId,
    ...(reason.reasonCode === undefined ? {} : { reasonCode: reason.reasonCode }),
    ...(request.value === undefined ? {} : { requestedValue: request.value }),
    ...(binding?.setpointKey === undefined ? {} : { setpointKey: binding.setpointKey }),
    simTime: request.simTime,
    status,
  });
}

/** Facility katmanının reason code'unu protokol sözlüğüne çevirir (çeviremezse `undefined`). */
export function toProtocolReasonCode(facilityReasonCode: string | undefined): ProtocolCommandReasonCode | undefined {
  return facilityReasonCode === undefined ? undefined : FACILITY_REASON_CODES[facilityReasonCode];
}

/** Facility katmanının sonucunu protokol outcome'una çevirir; ham kod kaybolmaz. */
export function facilityReasonToOutcomeReason(
  facilityReasonCode: string | undefined,
): { readonly facilityReasonCode?: string; readonly reasonCode?: ProtocolCommandReasonCode } {
  const reasonCode = toProtocolReasonCode(facilityReasonCode);
  return {
    ...(facilityReasonCode === undefined ? {} : { facilityReasonCode }),
    ...(reasonCode === undefined ? {} : { reasonCode }),
  };
}

/**
 * Bir tick'teki bütün action request'lerini §13.10 sırasına göre karara bağlar.
 *
 * 1. Safety Interlock her komutun üstündedir; priority yarışından ÖNCE eler.
 * 2. Kalanlar arasında en yüksek Protocol Priority kazanır.
 * 3. En yüksek priority'de uyumsuz değerler varsa HİÇBİRİ uygulanmaz + CONFLICT.
 * 4. Random / son yazan kazanır / creation order / render order KULLANILMAZ.
 */
export function arbitrateProtocolCommands(input: ProtocolArbitrationInput): ProtocolArbitrationPlan {
  const rejections: ProtocolCommandOutcome[] = [];
  const groups = new Map<string, ArbitrationEntry[]>();

  for (const request of input.requests) {
    const binding = input.resolveActuator(request);
    const facilityId = request.facilityId;
    if (binding === undefined || facilityId === undefined || (binding.actuator === 'set-setpoint' && binding.setpointKey === undefined)) {
      rejections.push(protocolCommandOutcome(request, binding, 'failed', { reasonCode: 'CAPABILITY_NOT_AVAILABLE' }));
      continue;
    }

    const definition = input.definitions.get(facilityId);
    const state = input.facilities.get(facilityId);
    if (definition === undefined || state === undefined) {
      rejections.push(protocolCommandOutcome(request, binding, 'failed', { reasonCode: 'TARGET_NOT_FOUND' }));
      continue;
    }

    // §13.10(1): Safety Interlock bütün command'ların üstündedir. Elenen komut
    // priority yarışına HİÇ girmez; güvenli bir düşük öncelikli komutu bloklamaz.
    const decision = input.interlock.evaluate(toFacilityCommand(request, facilityId, binding), state, definition);
    if (!decision.allowed) {
      rejections.push(protocolCommandOutcome(request, binding, 'blocked', facilityReasonToOutcomeReason(decision.reasonCode)));
      continue;
    }

    const key = groupKey(facilityId, binding);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [{ binding, facilityId, request }]);
    else group.push({ binding, facilityId, request });
  }

  const commands: ProtocolPlannedCommand[] = [];
  const conflicts: ProtocolCommandConflict[] = [];

  for (const key of [...groups.keys()].sort(compareStrings)) {
    const entries = [...(groups.get(key) ?? [])].sort(compareEntries);
    const first = entries[0];
    if (first === undefined) continue;

    // Hepsi aynı değeri istiyorsa çakışma yoktur; tek komut hepsini karşılar.
    let winners = entries;
    if (distinctValues(entries).length > 1) {
      const topRank = Math.max(...entries.map((entry) => priorityRank(entry.request.priority)));
      const top = entries.filter((entry) => priorityRank(entry.request.priority) === topRank);
      const topValues = distinctValues(top);
      if (topValues.length > 1) {
        // §13.10(3): hiçbiri uygulanmaz, mevcut state değişmez.
        const leader = top[0];
        if (leader !== undefined) {
          conflicts.push(Object.freeze({
            actuator: leader.binding.actuator,
            facilityId: leader.facilityId,
            priority: leader.request.priority,
            protocolExecutionIds: Object.freeze([...new Set(entries.map((entry) => entry.request.protocolExecutionId))].sort(compareStrings)),
            protocolIds: Object.freeze([...new Set(entries.map((entry) => entry.request.protocolId))].sort(compareStrings)),
            requestedValues: Object.freeze([...topValues].sort((left, right) => compareStrings(String(left), String(right)))),
            ...(leader.binding.setpointKey === undefined ? {} : { setpointKey: leader.binding.setpointKey }),
            simTime: leader.request.simTime,
          }));
        }
        for (const entry of entries) {
          rejections.push(protocolCommandOutcome(entry.request, entry.binding, 'blocked', { reasonCode: 'COMMAND_CONFLICT_EQUAL_PRIORITY' }));
        }
        continue;
      }
      // §13.10(2): en yüksek priority kazanır; kalanlar uygulanmaz.
      for (const entry of entries) {
        if (priorityRank(entry.request.priority) === topRank) continue;
        rejections.push(protocolCommandOutcome(entry.request, entry.binding, 'blocked', { reasonCode: 'COMMAND_SUPERSEDED_BY_PRIORITY' }));
      }
      winners = top;
    }

    const leader = winners[0];
    if (leader === undefined) continue;
    commands.push(Object.freeze({
      command: toFacilityCommand(leader.request, leader.facilityId, leader.binding),
      requests: Object.freeze(winners.map((entry) => entry.request)),
      ...(leader.binding.setpointKey === undefined ? {} : { setpointKey: leader.binding.setpointKey }),
    }));
  }

  return Object.freeze({
    commands: Object.freeze(commands),
    conflicts: Object.freeze(conflicts),
    rejections: Object.freeze(rejections),
  });
}
