import type { FacilityInstanceState } from '../domain/facilities/Facility';
import type { ResourcePoolState } from '../domain/resources/Resource';
import type { ColonistState, WorkforceSummary } from '../domain/workforce/Workforce';
import type { MaintenanceTaskState } from '../domain/maintenance/Maintenance';
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
    realSecondsPerSimulationHour: number;
    speed: SimulationSpeed;
  }>;
  readonly eventCount: number;
  readonly colonists: readonly ColonistState[];
  readonly facilities: readonly FacilityInstanceState[];
  readonly maintenanceTasks: readonly MaintenanceTaskState[];
  readonly resources: ResourcePoolState;
  readonly revision: number;
  readonly time: SimulationTimeSnapshot;
  readonly workforce: WorkforceSummary;
}
