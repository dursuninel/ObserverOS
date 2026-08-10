import type { FacilityDefinition, Priority } from '../../domain/facilities/Facility';
import type { MaintenanceTaskState } from '../../domain/maintenance/Maintenance';
import type { ColonistAssignmentState, ColonistState, TravelTaskState, WorkforceRequest, WorkforceSummary, WorkforceTaskType } from '../../domain/workforce/Workforce';
import type { SimulationConfig } from '../SimulationConfig';
import type { MutableFacilityState } from './facilityCommands';
import { resolveTravelDuration } from '../../domain/workforce/TravelNetwork';

export interface MutableTravelTaskState extends Omit<TravelTaskState, 'elapsedMinutes' | 'routeNodeIds'> {
  elapsedMinutes: number;
  routeNodeIds: readonly string[];
}

export interface MutableColonistAssignmentState extends Omit<ColonistAssignmentState, 'phase'> {
  phase: ColonistAssignmentState['phase'];
}

export interface MutableColonistState extends Omit<ColonistState, 'assignment' | 'locationId' | 'restDue' | 'state' | 'travel'> {
  assignment: MutableColonistAssignmentState | null;
  locationId: string;
  restDue: boolean;
  state: ColonistState['state'];
  travel: MutableTravelTaskState | null;
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
    return { assignment: null, id, locationId: 'habitat', restDue: resting, restGroup, state: resting ? 'resting' : 'available', travel: null };
  });
}

function createTravel(
  colonist: MutableColonistState,
  targetLocationId: string,
  purpose: TravelTaskState['purpose'],
  taskType: WorkforceTaskType,
  elapsedMinutes: number,
  config: SimulationConfig,
): MutableTravelTaskState | null {
  if (colonist.locationId === targetLocationId) return null;
  if (config.travelNetwork === undefined) return null;
  const resolved = resolveTravelDuration(config.travelNetwork, colonist.locationId, targetLocationId);
  return {
    durationMinutes: resolved.durationMinutes,
    elapsedMinutes: 0,
    id: `travel-${colonist.id}-${purpose}-${elapsedMinutes.toString().padStart(6, '0')}`,
    purpose,
    routeNodeIds: resolved.routeNodeIds,
    sourceLocationId: colonist.locationId,
    startedAt: elapsedMinutes,
    targetLocationId,
    taskType,
  };
}

function beginReturnToHabitat(colonist: MutableColonistState, elapsedMinutes: number, config: SimulationConfig): WorkforceTransition[] {
  if (colonist.travel !== null) return [];
  const previous = colonist.assignment;
  colonist.assignment = null;
  if (colonist.locationId === 'habitat') {
    colonist.state = 'resting';
    return [{ colonistId: colonist.id, ...(previous === null ? {} : { previousFacilityId: previous.facilityId }), type: 'rest-started' }];
  }
  colonist.travel = createTravel(colonist, 'habitat', 'return-to-habitat', previous?.taskType ?? 'operate', elapsedMinutes, config);
  colonist.state = 'working';
  return previous === null ? [] : [{ colonistId: colonist.id, previousFacilityId: previous.facilityId, type: 'released' }];
}

export function updateRestStates(colonists: MutableColonistState[], elapsedMinutes: number, config: SimulationConfig): WorkforceTransition[] {
  const transitions: WorkforceTransition[] = [];
  for (const colonist of colonists) {
    const shouldRest = isColonistResting(colonist.restGroup, elapsedMinutes, config);
    if (shouldRest) {
      colonist.restDue = true;
      if (colonist.state !== 'resting' && colonist.travel === null) transitions.push(...beginReturnToHabitat(colonist, elapsedMinutes, config));
    } else if (colonist.restDue) {
      colonist.restDue = false;
      if (colonist.state === 'resting') {
        colonist.state = 'available';
        transitions.push({ colonistId: colonist.id, type: 'rest-ended' });
      }
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
  const active = colonists.filter(({ restDue, state, travel }) => !restDue && state !== 'resting' && travel?.purpose !== 'return-to-habitat').sort((left, right) => left.id.localeCompare(right.id));
  const availableIds = new Set(active.map(({ id }) => id));
  const selected = new Map<string, string[]>();
  const requestIds = new Set(requests.map(({ id }) => id));
  for (const colonist of active) {
    if (colonist.travel?.purpose !== 'to-assignment' || colonist.assignment === null) continue;
    availableIds.delete(colonist.id);
    if (!requestIds.has(colonist.assignment.id)) continue;
    selected.set(colonist.assignment.id, [...(selected.get(colonist.assignment.id) ?? []), colonist.id]);
  }
  for (const request of ordered) assignForTarget(request, request.minimum, active, availableIds, selected, !request.canPartialAssign);
  for (const request of ordered) assignForTarget(request, request.desired, active, availableIds, selected, false);
  return selected;
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
      if (previous === null || colonist.travel?.purpose === 'to-assignment') continue;
      colonist.assignment = null;
      colonist.travel = instantOnSite ? null : createTravel(colonist, 'habitat', 'return-to-habitat', previous.taskType, elapsedMinutes, config);
      colonist.state = colonist.travel === null ? 'available' : 'working';
      transitions.push({ colonistId: colonist.id, previousFacilityId: previous.facilityId, type: 'released' });
      continue;
    }
    if (previous?.id === next.id) {
      colonist.state = 'working';
      continue;
    }
    if (colonist.travel !== null) continue;
    const travel = instantOnSite ? null : createTravel(colonist, next.targetEntityId, 'to-assignment', next.taskType, elapsedMinutes, config);
    colonist.assignment = {
      facilityId: next.targetEntityId,
      id: next.id,
      phase: travel === null ? 'on-site' : 'traveling',
      taskType: next.taskType,
    };
    colonist.travel = travel;
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

export function progressTravelTasks(colonists: MutableColonistState[], stepMinutes: number): WorkforceTransition[] {
  const transitions: WorkforceTransition[] = [];
  for (const colonist of colonists) {
    const travel = colonist.travel;
    if (travel === null) continue;
    travel.elapsedMinutes = Math.min(travel.durationMinutes, travel.elapsedMinutes + stepMinutes);
    if (travel.elapsedMinutes < travel.durationMinutes) continue;
    colonist.locationId = travel.targetLocationId;
    colonist.travel = null;
    if (travel.purpose === 'return-to-habitat') {
      colonist.assignment = null;
      colonist.state = colonist.restDue ? 'resting' : 'available';
      if (colonist.restDue) transitions.push({ colonistId: colonist.id, type: 'rest-started' });
    } else if (colonist.assignment !== null) {
      colonist.assignment.phase = 'on-site';
      colonist.state = 'working';
    }
  }
  return transitions;
}

export function updateFacilityWorkforce(facilities: ReadonlyMap<string, MutableFacilityState>, colonists: readonly MutableColonistState[]): void {
  for (const facility of facilities.values()) {
    facility.assignedWorkforce = 0;
    facility.effectiveWorkforce = 0;
  }
  for (const colonist of colonists) {
    const assignment = colonist.assignment;
    if (assignment === null || assignment.taskType !== 'operate' || colonist.restDue) continue;
    const facility = facilities.get(assignment.facilityId);
    if (facility === undefined) continue;
    facility.assignedWorkforce += 1;
    if (assignment.phase === 'on-site') facility.effectiveWorkforce += 1;
  }
}

export function workforceSummary(colonists: readonly MutableColonistState[]): WorkforceSummary {
  const resting = colonists.filter(({ state }) => state === 'resting').length;
  const traveling = colonists.filter(({ travel }) => travel !== null).length;
  const travelingToRest = colonists.filter(({ travel }) => travel?.purpose === 'return-to-habitat').length;
  const activeColonists = colonists.filter(({ restDue, state }) => !restDue && state !== 'resting');
  const assigned = activeColonists.filter(({ assignment }) => assignment !== null).length;
  const available = activeColonists.filter(({ assignment, travel }) => assignment === null && travel === null).length;
  return Object.freeze({ active: activeColonists.length, assigned, available, population: colonists.length, resting, traveling, travelingToRest });
}

export function toReadonlyColonist(colonist: MutableColonistState): ColonistState {
  const assignment = colonist.assignment === null ? null : Object.freeze({ ...colonist.assignment });
  const travel = colonist.travel === null ? null : Object.freeze({ ...colonist.travel, routeNodeIds: Object.freeze([...colonist.travel.routeNodeIds]) });
  return Object.freeze({ ...colonist, assignment, travel });
}
