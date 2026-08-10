import type { FacilityDefinition } from '../domain/facilities/Facility';
import type { ResourceId, ResourceRates } from '../domain/resources/Resource';
import type { TravelNetworkConfig } from '../domain/workforce/TravelNetwork';
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

export const PHASE_THREE_TRAVEL_NETWORK: TravelNetworkConfig = Object.freeze({
  edges: Object.freeze([
    { from: 'spine-solar', to: 'spine-reactor' }, { from: 'spine-reactor', to: 'spine-battery' },
    { from: 'spine-battery', to: 'spine-habitat' }, { from: 'spine-habitat', to: 'spine-oxygen' },
    { from: 'spine-oxygen', to: 'spine-mine' }, { from: 'spine-mine', to: 'spine-expansion' },
    ...['solar', 'reactor', 'battery', 'habitat', 'oxygen', 'mine', 'expansion'].flatMap((id) => [
      { from: `spine-${id}`, to: `${id}-approach` }, { from: `${id}-approach`, to: `${id}-entrance` },
    ]),
  ]),
  locationNodes: Object.freeze({
    'battery-01': 'battery-entrance', habitat: 'habitat-entrance', 'mine-01': 'mine-entrance',
    'oxygen-processor-01': 'oxygen-entrance', 'reactor-01': 'reactor-entrance',
  }),
  nodes: Object.freeze([
    { id: 'spine-solar', x: -6.5, z: 0 }, { id: 'spine-reactor', x: -4, z: 0 },
    { id: 'spine-battery', x: -1, z: 0 }, { id: 'spine-habitat', x: 1.5, z: 0 },
    { id: 'spine-oxygen', x: 4.5, z: 0 }, { id: 'spine-mine', x: 7, z: 0 },
    { id: 'spine-expansion', x: 9.5, z: 0 },
    { id: 'solar-approach', x: -6.5, z: 0.75 }, { id: 'solar-entrance', x: -6.5, z: 1.7 },
    { id: 'reactor-approach', x: -4, z: -0.75 }, { id: 'reactor-entrance', x: -4, z: -1.4 },
    { id: 'battery-approach', x: -1, z: 0.75 }, { id: 'battery-entrance', x: -1, z: 1.6 },
    { id: 'habitat-approach', x: 1.5, z: -0.75 }, { id: 'habitat-entrance', x: 1.5, z: -1.3 },
    { id: 'oxygen-approach', x: 4.5, z: 0.75 }, { id: 'oxygen-entrance', x: 4.5, z: 1.4 },
    { id: 'mine-approach', x: 7, z: -0.75 }, { id: 'mine-entrance', x: 7, z: -1.6 },
    { id: 'expansion-approach', x: 9.5, z: 0.75 }, { id: 'expansion-entrance', x: 9.5, z: 1.5 },
  ]),
  walkingSpeedUnitsPerSimulationMinute: 0.25,
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
    restCycleMinutes: number;
    restDurationMinutes: number;
    restGroupCount: number;
  }>;
  readonly travelNetwork?: TravelNetworkConfig;
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
    restCycleMinutes: 360,
    restDurationMinutes: 60,
    restGroupCount: 5,
  }),
  travelNetwork: PHASE_THREE_TRAVEL_NETWORK,
  wearModeMultipliers: Object.freeze({ eco: 0.5, normal: 1, boost: 2.5 }),
});

/** Compatibility export for Phase 2 callers; the canonical default now includes Phase 3 config. */
export const PHASE_TWO_BASELINE_CONFIG = PHASE_THREE_BASELINE_CONFIG;
