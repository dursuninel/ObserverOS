import type { FacilityDefinition, Priority } from '../../domain/facilities/Facility';
import type { MaintenanceTaskState } from '../../domain/maintenance/Maintenance';
import type { ColonistAssignmentState, ColonistState, TravelTaskState, WorkforceRequest, WorkforceSummary, WorkforceTaskType } from '../../domain/workforce/Workforce';
import type { SimulationConfig } from '../SimulationConfig';
import type { MutableFacilityState } from './facilityCommands';

export interface MutableTravelTaskState extends Omit<TravelTaskState, 'elapsedMinutes'> {
  elapsedMinutes: number;
}

export interface MutableColonistAssignmentState extends Omit<ColonistAssignmentState, 'phase' | 'travel'> {
  phase: ColonistAssignmentState['phase'];
  travel: MutableTravelTaskState | null;
}

export interface MutableColonistState extends Omit<ColonistState, 'assignment' | 'locationId' | 'state'> {
  assignment: MutableColonistAssignmentState | null;
  locationId: string;
  state: ColonistState['state'];
}

export interface WorkforceTransition {
  readonly colonistId: string;
  readonly facilityId?: string;
  readonly previousFacilityId?: string;
  readonly type: 'assigned' | 'released' | 'reassigned' | 'rest-ended' | 'rest-started';
}

const PRIORITY_RANK: Readonly<Record<Priority, number>> = Object.freeze({ critical: 3, high: 2, low: 0, normal: 1 });

function populationConfig(config: SimulationConfig) {
  return config.population ?? {
    count: 0,
    maintenanceTravelMinutes: 0,
    operationTravelMinutes: 0,
    restCycleMinutes: 1_440,
    restDurationMinutes: 0,
    restGroupCount: 1,
  };
}

export function isColonistResting(restGroup: number, elapsedMinutes: number, config: SimulationConfig): boolean {
  const population = populationConfig(config);
  if (population.restDurationMinutes === 0 || population.count === 0) return false;
  const groupOffset = restGroup * population.restCycleMinutes / population.restGroupCount;
  const local = ((elapsedMinutes - groupOffset) % population.restCycleMinutes + population.restCycleMinutes) % population.restCycleMinutes;
  return local < population.restDurationMinutes;
}

export function createColonists(config: SimulationConfig): MutableColonistState[] {
  const population = populationConfig(config);
  return Array.from({ length: population.count }, (_, index) => {
    const id = `colonist-${(index + 1).toString().padStart(3, '0')}`;
    const restGroup = index % population.restGroupCount;
    const resting = isColonistResting(restGroup, 0, config);
    return { assignment: null, id, locationId: 'habitat', restGroup, state: resting ? 'resting' : 'available' };
  });
}

export function updateRestStates(colonists: MutableColonistState[], elapsedMinutes: number, config: SimulationConfig): WorkforceTransition[] {
  const transitions: WorkforceTransition[] = [];
  for (const colonist of colonists) {
    const shouldRest = isColonistResting(colonist.restGroup, elapsedMinutes, config);
    if (shouldRest && colonist.state !== 'resting') {
      transitions.push({ colonistId: colonist.id, ...(colonist.assignment === null ? {} : { previousFacilityId: colonist.assignment.facilityId }), type: 'rest-started' });
      colonist.assignment = null;
      colonist.locationId = 'habitat';
      colonist.state = 'resting';
    } else if (!shouldRest && colonist.state === 'resting') {
      colonist.state = 'available';
      transitions.push({ colonistId: colonist.id, type: 'rest-ended' });
    }
  }
  return transitions;
}

function requestedWorkforce(definition: FacilityDefinition, state: MutableFacilityState): { minimum: number; desired: number } | null {
  if (definition.workforce === undefined || state.state !== 'online') return null;
  const boost = state.mode === 'boost' ? definition.workforce.boost : undefined;
  return { minimum: definition.workforce.minimum, desired: boost ?? definition.workforce.nominal };
}

export function createWorkforceRequests(
  definitions: readonly FacilityDefinition[],
  facilities: ReadonlyMap<string, MutableFacilityState>,
  maintenanceTasks: readonly MaintenanceTaskState[],
  materialStored: number,
): WorkforceRequest[] {
  const requests: WorkforceRequest[] = [];
  for (const definition of definitions) {
    const state = facilities.get(definition.id);
    if (state === undefined) continue;
    const workforce = requestedWorkforce(definition, state);
    if (workforce !== null) requests.push({
      canPartialAssign: false,
      createdSimTime: 0,
      desired: workforce.desired,
      id: `work-operate-${definition.id}`,
      minimum: workforce.minimum,
      priority: state.workPriority,
      targetEntityId: definition.id,
      taskType: 'operate',
    });
  }
  for (const task of maintenanceTasks) {
    if (task.status === 'completed' || (!task.materialConsumed && materialStored < task.materialRequired)) continue;
    requests.push({
      canPartialAssign: false,
      createdSimTime: task.requestedAt,
      desired: task.workforceRequired,
      id: `work-${task.id}`,
      minimum: task.workforceRequired,
      priority: task.priority,
      targetEntityId: task.facilityId,
      taskType: 'maintenance',
    });
  }
  return requests;
}

export function compareWorkforceRequests(left: WorkforceRequest, right: WorkforceRequest): number {
  return PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority]
    || left.targetEntityId.localeCompare(right.targetEntityId)
    || left.taskType.localeCompare(right.taskType)
    || left.createdSimTime - right.createdSimTime
    || left.id.localeCompare(right.id);
}

function assignForTarget(
  request: WorkforceRequest,
  count: number,
  colonists: readonly MutableColonistState[],
  availableIds: Set<string>,
  selected: Map<string, string[]>,
  requireFull: boolean,
): void {
  const current = selected.get(request.id) ?? [];
  const needed = Math.max(0, count - current.length);
  if (needed === 0) return;
  const candidates = colonists
    .filter((colonist) => availableIds.has(colonist.id))
    .sort((left, right) => {
      const leftKeeps = left.assignment?.id === request.id ? 0 : 1;
      const rightKeeps = right.assignment?.id === request.id ? 0 : 1;
      return leftKeeps - rightKeeps || left.id.localeCompare(right.id);
    });
  if (requireFull && candidates.length < needed) return;
  const chosen = candidates.slice(0, needed);
  for (const colonist of chosen) availableIds.delete(colonist.id);
  selected.set(request.id, [...current, ...chosen.map(({ id }) => id)]);
}

export function allocateWorkforce(requests: readonly WorkforceRequest[], colonists: readonly MutableColonistState[]): ReadonlyMap<string, readonly string[]> {
  const ordered = [...requests].sort(compareWorkforceRequests);
  const active = colonists.filter(({ state }) => state !== 'resting').sort((left, right) => left.id.localeCompare(right.id));
  const availableIds = new Set(active.map(({ id }) => id));
  const selected = new Map<string, string[]>();
  for (const request of ordered) assignForTarget(request, request.minimum, active, availableIds, selected, !request.canPartialAssign);
  for (const request of ordered) assignForTarget(request, request.desired, active, availableIds, selected, false);
  return selected;
}

function travelDuration(taskType: WorkforceTaskType, config: SimulationConfig): number {
  const population = populationConfig(config);
  return taskType === 'maintenance' ? population.maintenanceTravelMinutes : population.operationTravelMinutes;
}

export function applyWorkforceAllocation(
  requests: readonly WorkforceRequest[],
  allocation: ReadonlyMap<string, readonly string[]>,
  colonists: MutableColonistState[],
  elapsedMinutes: number,
  config: SimulationConfig,
  instantOnSite = false,
): WorkforceTransition[] {
  const transitions: WorkforceTransition[] = [];
  const assignmentByColonist = new Map<string, WorkforceRequest>();
  for (const request of requests) for (const colonistId of allocation.get(request.id) ?? []) assignmentByColonist.set(colonistId, request);

  for (const colonist of colonists) {
    if (colonist.state === 'resting') continue;
    const next = assignmentByColonist.get(colonist.id);
    const previous = colonist.assignment;
    if (next === undefined) {
      if (previous !== null) transitions.push({ colonistId: colonist.id, previousFacilityId: previous.facilityId, type: 'released' });
      colonist.assignment = null;
      colonist.state = 'available';
      continue;
    }
    if (previous?.id === next.id) {
      colonist.state = 'working';
      continue;
    }
    const durationMinutes = instantOnSite ? 0 : travelDuration(next.taskType, config);
    const travel: MutableTravelTaskState | null = durationMinutes === 0 ? null : {
      durationMinutes,
      elapsedMinutes: 0,
      id: `travel-${colonist.id}-${next.id}-${elapsedMinutes.toString().padStart(6, '0')}`,
      sourceLocationId: colonist.locationId,
      startedAt: elapsedMinutes,
      targetFacilityId: next.targetEntityId,
      taskType: next.taskType,
    };
    colonist.assignment = {
      facilityId: next.targetEntityId,
      id: next.id,
      phase: travel === null ? 'on-site' : 'traveling',
      taskType: next.taskType,
      travel,
    };
    if (travel === null) colonist.locationId = next.targetEntityId;
    colonist.state = 'working';
    transitions.push({
      colonistId: colonist.id,
      facilityId: next.targetEntityId,
      ...(previous === null ? {} : { previousFacilityId: previous.facilityId }),
      type: previous === null ? 'assigned' : 'reassigned',
    });
  }
  return transitions;
}

export function progressTravelTasks(colonists: MutableColonistState[], stepMinutes: number): string[] {
  const arrived: string[] = [];
  for (const colonist of colonists) {
    const assignment = colonist.assignment;
    const travel = assignment?.travel;
    if (assignment === null || assignment === undefined || travel === null || travel === undefined) continue;
    travel.elapsedMinutes = Math.min(travel.durationMinutes, travel.elapsedMinutes + stepMinutes);
    if (travel.elapsedMinutes < travel.durationMinutes) continue;
    assignment.phase = 'on-site';
    assignment.travel = null;
    colonist.locationId = assignment.facilityId;
    arrived.push(colonist.id);
  }
  return arrived;
}

export function updateFacilityWorkforce(facilities: ReadonlyMap<string, MutableFacilityState>, colonists: readonly MutableColonistState[]): void {
  for (const facility of facilities.values()) {
    facility.assignedWorkforce = 0;
    facility.effectiveWorkforce = 0;
  }
  for (const colonist of colonists) {
    const assignment = colonist.assignment;
    if (assignment === null || assignment.taskType !== 'operate') continue;
    const facility = facilities.get(assignment.facilityId);
    if (facility === undefined) continue;
    facility.assignedWorkforce += 1;
    if (assignment.phase === 'on-site') facility.effectiveWorkforce += 1;
  }
}

export function workforceSummary(colonists: readonly MutableColonistState[]): WorkforceSummary {
  const resting = colonists.filter(({ state }) => state === 'resting').length;
  const assigned = colonists.filter(({ assignment, state }) => state !== 'resting' && assignment !== null).length;
  const active = colonists.length - resting;
  return Object.freeze({ active, assigned, available: active - assigned, population: colonists.length, resting });
}

export function toReadonlyColonist(colonist: MutableColonistState): ColonistState {
  const assignment = colonist.assignment === null ? null : Object.freeze({
    ...colonist.assignment,
    travel: colonist.assignment.travel === null ? null : Object.freeze({ ...colonist.assignment.travel }),
  });
  return Object.freeze({ ...colonist, assignment });
}
