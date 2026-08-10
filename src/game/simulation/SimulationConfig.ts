import type { FacilityDefinition } from '../domain/facilities/Facility';
import type { ResourceId, ResourceRates } from '../domain/resources/Resource';
import type { SimulationClockConfig, SimulationSpeed } from './SimulationClock';

export interface SimulationConfig {
  readonly baseConsumptionPerHour: ResourceRates;
  readonly clock: SimulationClockConfig;
  readonly daylightDurationMinutes: number;
  readonly facilities: readonly FacilityDefinition[];
  readonly initialResources: Readonly<Record<ResourceId, number>>;
  readonly initialSpeed: SimulationSpeed;
}

export const PHASE_TWO_BASELINE_CONFIG: SimulationConfig = Object.freeze({
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
});
