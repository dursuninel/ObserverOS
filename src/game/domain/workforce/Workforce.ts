import type { Priority } from '../facilities/Facility';

export type ColonistMainState = 'available' | 'working' | 'resting';
export type WorkforceTaskType = 'maintenance' | 'operate';
export type AssignmentPhase = 'on-site' | 'traveling';
export type TravelPurpose = 'return-to-habitat' | 'to-assignment';

export interface TravelTaskState {
  readonly durationMinutes: number;
  readonly elapsedMinutes: number;
  readonly id: string;
  readonly purpose: TravelPurpose;
  readonly routeNodeIds: readonly string[];
  readonly sourceLocationId: string;
  readonly startedAt: number;
  readonly targetLocationId: string;
  readonly taskType: WorkforceTaskType;
}

export interface ColonistAssignmentState {
  readonly facilityId: string;
  readonly id: string;
  readonly phase: AssignmentPhase;
  readonly taskType: WorkforceTaskType;
}

export interface ColonistState {
  readonly assignment: ColonistAssignmentState | null;
  readonly id: string;
  readonly locationId: string;
  readonly restDue: boolean;
  readonly restGroup: number;
  readonly state: ColonistMainState;
  readonly travel: TravelTaskState | null;
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
  readonly traveling: number;
  readonly travelingToRest: number;
}
