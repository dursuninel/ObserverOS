import type { Priority } from '../facilities/Facility';

export type ColonistMainState = 'available' | 'working' | 'resting';
export type WorkforceTaskType = 'maintenance' | 'operate';
export type AssignmentPhase = 'on-site' | 'traveling';

export interface TravelTaskState {
  readonly durationMinutes: number;
  readonly elapsedMinutes: number;
  readonly id: string;
  readonly sourceLocationId: string;
  readonly startedAt: number;
  readonly targetFacilityId: string;
  readonly taskType: WorkforceTaskType;
}

export interface ColonistAssignmentState {
  readonly facilityId: string;
  readonly id: string;
  readonly phase: AssignmentPhase;
  readonly taskType: WorkforceTaskType;
  readonly travel: TravelTaskState | null;
}

export interface ColonistState {
  readonly assignment: ColonistAssignmentState | null;
  readonly id: string;
  readonly locationId: string;
  readonly restGroup: number;
  readonly state: ColonistMainState;
}

export interface WorkforceRequest {
  readonly canPartialAssign: boolean;
  readonly createdSimTime: number;
  readonly desired: number;
  readonly id: string;
  readonly minimum: number;
  readonly priority: Priority;
  readonly targetEntityId: string;
  readonly taskType: WorkforceTaskType;
}

export interface WorkforceSummary {
  readonly active: number;
  readonly assigned: number;
  readonly available: number;
  readonly population: number;
  readonly resting: number;
}
