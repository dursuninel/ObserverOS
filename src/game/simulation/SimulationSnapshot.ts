import type { FacilityInstanceState } from '../domain/facilities/Facility';
import type { ResourcePoolState } from '../domain/resources/Resource';
import type { SimulationSpeed } from './SimulationClock';

export interface SimulationTimeSnapshot {
  readonly cycleProgress: number;
  readonly dayIndex: number;
  readonly dayPhase: 'day' | 'night';
  readonly elapsedMinutes: number;
  readonly localMinute: number;
}

export interface SimulationSnapshot {
  readonly clock: Readonly<{
    fixedStepMinutes: number;
    paused: boolean;
    speed: SimulationSpeed;
  }>;
  readonly eventCount: number;
  readonly facilities: readonly FacilityInstanceState[];
  readonly resources: ResourcePoolState;
  readonly revision: number;
  readonly time: SimulationTimeSnapshot;
}

