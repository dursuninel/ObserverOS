import {
  FACILITY_MODES,
  PRIORITIES,
  type FacilityDefinition,
  type FacilityInstanceState,
} from '../../domain/facilities/Facility';
import type {
  ProtocolActionCapability,
  ProtocolActionClaim,
  ProtocolCapabilities,
  ProtocolDefinition,
  ProtocolFacilityCapability,
  ProtocolLiteral,
  ProtocolSensorCapability,
  ProtocolValidationLimits,
} from '../../domain/protocol/Protocol';
import type { SimulationSnapshot } from '../SimulationSnapshot';
import { PLAYER_OPERATING_TARGETS } from '../systems/facilityCommands';
import type { ProtocolSensorReader } from './protocolRuntime';

/**
 * Capability köprüsü: yetkili simülasyon durumundan `ProtocolCapabilities` ve
 * sensor okuyucusu üretir (§12 capability katmanı data-driven'dır).
 *
 * GEÇİCİ KAPSAM — kanonik ölçüm (sensor) kataloğu Faz 8 (HELIOS içeriği) işidir.
 * Burada YENİ ölçüm kimliği UYDURULMAZ: yalnız Faz 5 runtime'ında ve başlangıç
 * protokollerinde hâlihazırda kullanılan iki kimlik taşınır. Eylem tarafı uydurma
 * değildir; `FACILITY_ACTUATORS` zaten kanoniktir.
 *
 * Headless'tır: React/tarayıcı bağımlılığı, saat ve rastgelelik kaynağı yoktur;
 * bütün listeler kimliğe göre stable sıradadır.
 */

/** Tesise bağlı okunan ölçümler. */
export const PROTOCOL_FACILITY_SENSOR_IDS: readonly string[] = Object.freeze(['facility-condition']);
/** Koloni genelinde okunan, tesise bağlı OLMAYAN ölçümler. */
export const PROTOCOL_COLONY_SENSOR_IDS: readonly string[] = Object.freeze(['energy-level']);

export const PROTOCOL_SENSOR_CATALOG: readonly ProtocolSensorCapability[] = Object.freeze([
  Object.freeze({ id: 'energy-level', valueType: 'number' } as const),
  Object.freeze({ id: 'facility-condition', valueType: 'number' } as const),
]);

/**
 * Eylem kataloğu — `FACILITY_ACTUATORS` karşılıkları.
 *
 * `set-setpoint` bilinçli olarak DIŞARIDA: değeri `{ key, value }` nesnesidir, protokol
 * literal'i (boolean/number/string) değildir ve kanonik bir setpoint anahtarı kataloğu
 * henüz yoktur. Uydurulmuş anahtar yerine eylem hiç sunulmaz.
 */
export const PROTOCOL_ACTION_CATALOG: readonly ProtocolActionCapability[] = Object.freeze([
  Object.freeze({ id: 'set-condition', requiresTarget: true, requiresValue: true, valueType: 'number' } as const),
  Object.freeze({ allowedValues: PRIORITIES, id: 'set-energy-priority', requiresTarget: true, requiresValue: true, valueType: 'enum:priority' } as const),
  Object.freeze({ allowedValues: PRIORITIES, id: 'set-maintenance-priority', requiresTarget: true, requiresValue: true, valueType: 'enum:priority' } as const),
  Object.freeze({ allowedValues: FACILITY_MODES, id: 'set-mode', requiresTarget: true, requiresValue: true, valueType: 'enum:facility-mode' } as const),
  Object.freeze({ allowedValues: PLAYER_OPERATING_TARGETS, id: 'set-operating-state', requiresTarget: true, requiresValue: true, valueType: 'enum:facility-operating-state' } as const),
  Object.freeze({ allowedValues: PRIORITIES, id: 'set-work-priority', requiresTarget: true, requiresValue: true, valueType: 'enum:priority' } as const),
]);

/** Mod eylemi yalnız tanımında mod bulunan tesiste vardır; depo/tank mod değiştirmez. */
function facilityActionIds(definition: FacilityDefinition): readonly string[] {
  return PROTOCOL_ACTION_CATALOG
    .filter((action) => action.id !== 'set-mode' || definition.modes !== undefined)
    .map((action) => action.id);
}

/** §53.3 `action-value-unchanged` uyarısının beslendiği "şu anki değer" tablosu. */
function currentActionValues(state: FacilityInstanceState): Readonly<Record<string, ProtocolLiteral>> {
  const values: Record<string, ProtocolLiteral> = {
    'set-condition': state.condition,
    'set-energy-priority': state.energyPriority,
    'set-maintenance-priority': state.maintenancePriority,
    'set-operating-state': state.state,
    'set-work-priority': state.workPriority,
  };
  if (state.mode !== null) values['set-mode'] = state.mode;
  return Object.freeze(values);
}

/** Aktif protokollerin sahiplendiği eylemler; §53.3 `potential-conflict` bunu okur. */
function actionClaims(protocols: readonly ProtocolDefinition[]): readonly ProtocolActionClaim[] {
  const claims: ProtocolActionClaim[] = [];
  for (const protocol of [...protocols].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))) {
    if (protocol.lifecycle !== 'active') continue;
    for (const node of [...protocol.nodes].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))) {
      if (node.kind !== 'action' || node.actionId === '') continue;
      claims.push(Object.freeze({
        actionId: node.actionId,
        ...(node.facilityId === undefined ? {} : { facilityId: node.facilityId }),
        protocolId: protocol.id,
      }));
    }
  }
  return Object.freeze(claims);
}

export interface ProtocolCapabilityInput {
  /** Koloninin tesis tanımları (hangi eylemin hangi tesiste anlamı olduğunu belirler). */
  readonly definitions: readonly FacilityDefinition[];
  readonly limits: ProtocolValidationLimits;
  /** Çakışma uyarısı için mevcut protokol kitaplığı; yalnız `active` olanlar sahiplenir. */
  readonly protocols?: readonly ProtocolDefinition[];
  /** Yetkili anlık durum; verilirse "zaten bu değerde" uyarısı üretilebilir. */
  readonly states?: readonly FacilityInstanceState[];
}

export function buildProtocolCapabilities(input: ProtocolCapabilityInput): ProtocolCapabilities {
  const stateById = new Map((input.states ?? []).map((state) => [state.id, state] as const));
  const facilities: ProtocolFacilityCapability[] = [...input.definitions]
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    .map((definition) => {
      const state = stateById.get(definition.id);
      return Object.freeze({
        actionIds: Object.freeze(facilityActionIds(definition)),
        ...(state === undefined ? {} : { currentActionValues: currentActionValues(state) }),
        id: definition.id,
        sensorIds: Object.freeze([...PROTOCOL_FACILITY_SENSOR_IDS]),
      });
    });

  return Object.freeze({
    actions: PROTOCOL_ACTION_CATALOG,
    activeActionClaims: actionClaims(input.protocols ?? []),
    facilities: Object.freeze(facilities),
    limits: input.limits,
    sensors: PROTOCOL_SENSOR_CATALOG,
  });
}

/**
 * Ölçüm okuyucusu: protokol runtime'ının tick içinde çağırdığı köprü.
 *
 * `energy-level` koloni geneli enerji doluluğudur (yüzde); kapasite tanımlı değilse
 * ham stok döner. `facility-condition` yalnız bir tesis hedeflenmişse çözülür —
 * koloni geneli "kondisyon" diye bir birleşik ölçü UYDURULMAZ, çözülemeyen okuma
 * `undefined` döner ve runtime bunu iz adımı olarak yazar (§53.5).
 */
export function createProtocolSensorReader(getSnapshot: () => SimulationSnapshot | undefined): ProtocolSensorReader {
  return (sensorId, facilityId) => {
    const snapshot = getSnapshot();
    if (snapshot === undefined) return undefined;
    if (sensorId === 'energy-level') {
      const energy = snapshot.resources.energy;
      return energy.capacity > 0 ? (energy.stored / energy.capacity) * 100 : energy.stored;
    }
    if (sensorId !== 'facility-condition' || facilityId === undefined) return undefined;
    return snapshot.facilities.find((facility) => facility.id === facilityId)?.condition;
  };
}
