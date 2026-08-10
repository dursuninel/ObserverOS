import type { FacilityDefinition, FacilityOperatingState, Priority } from '../../domain/facilities/Facility';
import type { MaintenanceTaskState, MaintenanceTaskStatus } from '../../domain/maintenance/Maintenance';
import type { MutableResourcePoolState } from './resourceLedger';
import type { MutableFacilityState } from './facilityCommands';
import type { MutableColonistState } from './workforceSystem';
import { conditionBand } from './conditionSystem';

export interface MutableMaintenanceTaskState extends Omit<MaintenanceTaskState,
  'completedAt' | 'materialConsumed' | 'priority' | 'previousFacilityState' | 'reasonCode' | 'remainingMinutes' | 'startedAt' | 'status' | 'workerIds'> {
  completedAt: number | null;
  materialConsumed: boolean;
  priority: Priority;
  previousFacilityState: FacilityOperatingState | null;
  reasonCode: string | null;
  remainingMinutes: number;
  startedAt: number | null;
  status: MaintenanceTaskStatus;
  workerIds: string[];
}

export interface MaintenanceTransition {
  readonly facilityId: string;
  readonly reasonCode?: string;
  readonly recoveredFromFailure?: boolean;
  readonly taskId: string;
  readonly type: 'completed' | 'requested' | 'started' | 'waiting';
}

const PRIORITY_RANK: Readonly<Record<Priority, number>> = Object.freeze({ critical: 3, high: 2, low: 0, normal: 1 });

export function compareMaintenanceTasks(left: MaintenanceTaskState, right: MaintenanceTaskState): number {
  return PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority]
    || left.facilityId.localeCompare(right.facilityId)
    || left.requestedAt - right.requestedAt
    || left.id.localeCompare(right.id);
}

export function refreshMaintenanceRequests(
  definitions: readonly FacilityDefinition[],
  facilities: ReadonlyMap<string, MutableFacilityState>,
  tasks: MutableMaintenanceTaskState[],
  elapsedMinutes: number,
  threshold: number,
): MaintenanceTransition[] {
  const transitions: MaintenanceTransition[] = [];
  for (const definition of definitions) {
    const facility = facilities.get(definition.id);
    if (facility === undefined || definition.maintenance === undefined || facility.condition >= threshold) continue;
    const active = tasks.some((task) => task.facilityId === definition.id && task.status !== 'completed');
    if (active) continue;
    const task: MutableMaintenanceTaskState = {
      completedAt: null,
      durationMinutes: definition.maintenance.durationMinutes,
      facilityId: definition.id,
      id: `maintenance-${definition.id}-${elapsedMinutes.toString().padStart(6, '0')}`,
      materialConsumed: false,
      materialRequired: definition.maintenance.material,
      previousFacilityState: null,
      priority: facility.maintenancePriority,
      reasonCode: null,
      remainingMinutes: definition.maintenance.durationMinutes,
      requestedAt: elapsedMinutes,
      startedAt: null,
      status: 'requested',
      workerIds: [],
      workforceRequired: definition.maintenance.workforce,
    };
    tasks.push(task);
    transitions.push({ facilityId: definition.id, taskId: task.id, type: 'requested' });
  }
  return transitions;
}

function setWaiting(task: MutableMaintenanceTaskState, status: 'waiting-resources' | 'waiting-workforce', reasonCode: string): MaintenanceTransition | null {
  if (task.status === status && task.reasonCode === reasonCode) return null;
  task.status = status;
  task.reasonCode = reasonCode;
  return { facilityId: task.facilityId, reasonCode, taskId: task.id, type: 'waiting' };
}

export function updateMaintenanceTasks(
  stepMinutes: number,
  elapsedMinutes: number,
  definitions: ReadonlyMap<string, FacilityDefinition>,
  facilities: ReadonlyMap<string, MutableFacilityState>,
  colonists: readonly MutableColonistState[],
  resources: MutableResourcePoolState,
  tasks: MutableMaintenanceTaskState[],
): MaintenanceTransition[] {
  const transitions: MaintenanceTransition[] = [];
  for (const task of [...tasks].sort(compareMaintenanceTasks)) {
    if (task.status === 'completed') continue;
    const definition = definitions.get(task.facilityId);
    const facility = facilities.get(task.facilityId);
    if (definition?.maintenance === undefined || facility === undefined) continue;
    task.priority = facility.maintenancePriority;
    const assigned = colonists
      .filter(({ assignment }) => assignment?.id === `work-${task.id}`)
      .sort((left, right) => left.id.localeCompare(right.id));
    task.workerIds = assigned.map(({ id }) => id);

    if (!task.materialConsumed && resources.material.stored < task.materialRequired) {
      const transition = setWaiting(task, 'waiting-resources', 'maintenance.material-insufficient');
      if (transition !== null) transitions.push(transition);
      continue;
    }
    if (assigned.length < task.workforceRequired) {
      const transition = setWaiting(task, 'waiting-workforce', 'maintenance.workforce-insufficient');
      if (transition !== null) transitions.push(transition);
      continue;
    }
    if (!task.materialConsumed) {
      resources.material.stored -= task.materialRequired;
      task.materialConsumed = true;
      task.startedAt = elapsedMinutes;
      task.status = 'traveling';
      task.reasonCode = null;
    }

    const allOnSite = assigned.every(({ assignment }) => assignment?.phase === 'on-site');
    if (!allOnSite) {
      task.status = 'traveling';
      task.reasonCode = null;
      continue;
    }
    if (task.status !== 'in-progress') {
      task.status = 'in-progress';
      task.reasonCode = null;
      task.previousFacilityState = facility.state;
      if (definition.maintenance.offlineDuringMaintenance) facility.state = 'maintenance';
      transitions.push({ facilityId: task.facilityId, taskId: task.id, type: 'started' });
      continue;
    }
    task.remainingMinutes = Math.max(0, task.remainingMinutes - stepMinutes);
    if (task.remainingMinutes > 0) continue;
    task.status = 'completed';
    task.completedAt = elapsedMinutes;
    task.workerIds = [];
    facility.condition = definition.maintenance.restoreCondition;
    facility.conditionBand = conditionBand(facility.condition);
    facility.state = 'online';
    transitions.push({ facilityId: task.facilityId, recoveredFromFailure: task.previousFacilityState === 'failed', taskId: task.id, type: 'completed' });
  }
  return transitions;
}

export function toReadonlyMaintenanceTask(task: MutableMaintenanceTaskState): MaintenanceTaskState {
  return Object.freeze({ ...task, workerIds: Object.freeze([...task.workerIds]) });
}
