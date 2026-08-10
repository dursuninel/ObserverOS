import type { Priority } from '../facilities/Facility';
import type { FacilityOperatingState } from '../facilities/Facility';

export type MaintenanceTaskStatus =
  | 'requested'
  | 'waiting-resources'
  | 'waiting-workforce'
  | 'traveling'
  | 'in-progress'
  | 'completed';

export interface MaintenanceTaskState {
  readonly completedAt: number | null;
  readonly durationMinutes: number;
  readonly facilityId: string;
  readonly id: string;
  readonly materialConsumed: boolean;
  readonly materialRequired: number;
  readonly priority: Priority;
  readonly previousFacilityState: FacilityOperatingState | null;
  readonly reasonCode: string | null;
  readonly remainingMinutes: number;
  readonly requestedAt: number;
  readonly startedAt: number | null;
  readonly status: MaintenanceTaskStatus;
  readonly workerIds: readonly string[];
  readonly workforceRequired: number;
}
