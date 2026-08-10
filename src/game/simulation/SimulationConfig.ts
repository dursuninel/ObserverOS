import type { FacilityDefinition } from '../domain/facilities/Facility';
import type { ResourceId, ResourceRates } from '../domain/resources/Resource';
import type { SimulationClockConfig, SimulationSpeed } from './SimulationClock';

export const PHASE_THREE_WORKFORCE_BASELINES = Object.freeze({
  'fusion-reactor': Object.freeze({ minimum: 2, nominal: 3, boost: 4 }),
  mine: Object.freeze({ minimum: 1, nominal: 3, boost: 3 }),
  'oxygen-processor': Object.freeze({ minimum: 1, nominal: 2, boost: 3 }),
  'thermal-control': Object.freeze({ minimum: 1, nominal: 2, boost: 3 }),
});

export const PHASE_THREE_WEAR_BASELINES = Object.freeze({
  'fusion-reactor': Object.freeze({ basePerHour: 0.2 }),
  mine: Object.freeze({ basePerHour: 0.25 }),
  'oxygen-processor': Object.freeze({ basePerHour: 0.15 }),
  'thermal-control': Object.freeze({ basePerHour: 0.18 }),
});

export const PHASE_THREE_MAINTENANCE_BASELINES = Object.freeze({
  'fusion-reactor': Object.freeze({ workforce: 2, material: 10, durationMinutes: 180, restoreCondition: 95, offlineDuringMaintenance: true }),
  mine: Object.freeze({ workforce: 2, material: 6, durationMinutes: 120, restoreCondition: 95, offlineDuringMaintenance: true }),
  'oxygen-processor': Object.freeze({ workforce: 1, material: 4, durationMinutes: 90, restoreCondition: 95, offlineDuringMaintenance: true }),
  'thermal-control': Object.freeze({ workforce: 1, material: 5, durationMinutes: 120, restoreCondition: 95, offlineDuringMaintenance: true }),
});

export interface SimulationConfig {
  readonly baseConsumptionPerHour: ResourceRates;
  readonly clock: SimulationClockConfig;
  readonly daylightDurationMinutes: number;
  readonly facilities: readonly FacilityDefinition[];
  readonly initialResources: Readonly<Record<ResourceId, number>>;
  readonly initialSpeed: SimulationSpeed;
  readonly maintenanceThreshold?: number;
  readonly population?: Readonly<{
    count: number;
    maintenanceTravelMinutes: number;
    operationTravelMinutes: number;
    restCycleMinutes: number;
    restDurationMinutes: number;
    restGroupCount: number;
  }>;
  readonly wearModeMultipliers?: Readonly<Record<'boost' | 'eco' | 'normal', number>>;
}

export const PHASE_THREE_BASELINE_CONFIG: SimulationConfig = Object.freeze({
  baseConsumptionPerHour: Object.freeze({}),
  clock: Object.freeze({
    fixedStepMinutes: 1,
    localDayMinutes: 24 * 60,
    realSecondsPerSimulationHour: 25,
  }),
  daylightDurationMinutes: 14 * 60,
  facilities: Object.freeze([
    {
      id: 'reactor-01',
      initialCondition: 100,
      initialMode: 'normal',
      initialState: 'online',
      modes: {
        eco: { productionPerHour: { energy: 55 } },
        normal: { productionPerHour: { energy: 80 } },
        boost: { productionPerHour: { energy: 110 } },
      },
      safety: { boostConditionMinimum: 30, requiresRampedModeChange: true },
      typeId: 'fusion-reactor',
      workforce: PHASE_THREE_WORKFORCE_BASELINES['fusion-reactor'],
      wear: PHASE_THREE_WEAR_BASELINES['fusion-reactor'],
      maintenance: PHASE_THREE_MAINTENANCE_BASELINES['fusion-reactor'],
    },
    {
      id: 'battery-01',
      initialCondition: 100,
      initialState: 'standby',
      storageCapacity: { energy: 360 },
      typeId: 'battery-bank',
    },
    {
      id: 'mine-01',
      initialCondition: 100,
      initialMode: 'normal',
      initialState: 'online',
      modes: {
        eco: { consumptionPerHour: { energy: 8 }, productionPerHour: { material: 6 } },
        normal: { consumptionPerHour: { energy: 18 }, productionPerHour: { material: 12 } },
        boost: { consumptionPerHour: { energy: 30 }, productionPerHour: { material: 18 } },
      },
      safety: { boostConditionMinimum: 30 },
      typeId: 'mine',
      workforce: PHASE_THREE_WORKFORCE_BASELINES.mine,
      wear: PHASE_THREE_WEAR_BASELINES.mine,
      maintenance: PHASE_THREE_MAINTENANCE_BASELINES.mine,
    },
    {
      id: 'oxygen-processor-01',
      initialCondition: 100,
      initialMode: 'normal',
      initialState: 'online',
      modes: {
        eco: { consumptionPerHour: { energy: 6 }, productionPerHour: { oxygen: 15 } },
        normal: { consumptionPerHour: { energy: 10 }, productionPerHour: { oxygen: 25 } },
        boost: { consumptionPerHour: { energy: 16 }, productionPerHour: { oxygen: 35 } },
      },
      safety: { boostConditionMinimum: 30 },
      typeId: 'oxygen-processor',
      workforce: PHASE_THREE_WORKFORCE_BASELINES['oxygen-processor'],
      wear: PHASE_THREE_WEAR_BASELINES['oxygen-processor'],
      maintenance: PHASE_THREE_MAINTENANCE_BASELINES['oxygen-processor'],
    },
    {
      id: 'oxygen-reserve-01',
      initialCondition: 100,
      initialState: 'standby',
      storageCapacity: { oxygen: 240 },
      typeId: 'oxygen-reserve-tank',
    },
    {
      id: 'material-storage-01',
      initialCondition: 100,
      initialState: 'standby',
      storageCapacity: { material: 500 },
      typeId: 'material-storage',
    },
  ] satisfies readonly FacilityDefinition[]),
  initialResources: Object.freeze({ energy: 180, material: 0, oxygen: 120 }),
  initialSpeed: 1,
  maintenanceThreshold: 60,
  population: Object.freeze({
    count: 11,
    maintenanceTravelMinutes: 12,
    operationTravelMinutes: 1,
    restCycleMinutes: 1_440,
    restDurationMinutes: 240,
    restGroupCount: 5,
  }),
  wearModeMultipliers: Object.freeze({ eco: 0.5, normal: 1, boost: 2.5 }),
});

/** Compatibility export for Phase 2 callers; the canonical default now includes Phase 3 config. */
export const PHASE_TWO_BASELINE_CONFIG = PHASE_THREE_BASELINE_CONFIG;
