import type { ColonistState } from '../../domain/workforce/Workforce';
import { getPolylineDistance, type CharacterAnimation } from './navigation';
import { getFacilityPlacement, getFacilityWorkPoint, getHabitatPresentationPoints, getRoadNode, type Point2 } from './prototypeLayout';
import type { FacilityId } from './types';

export interface AuthoritativeColonistPose {
  readonly activity: boolean;
  readonly animation: CharacterAnimation;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly visible: boolean;
}

const facilityByInstanceId: Readonly<Record<string, FacilityId>> = Object.freeze({
  'battery-01': 'battery',
  'mine-01': 'mine',
  'oxygen-processor-01': 'oxygen',
  'reactor-01': 'reactor',
});

const toWorld = ([x, z]: Point2): readonly [number, number, number] => [x, 0.32, z];

function stableIndex(colonistId: string): number {
  const numeric = Number.parseInt(colonistId.split('-').at(-1) ?? '1', 10);
  return Number.isFinite(numeric) ? Math.max(0, numeric - 1) : 0;
}

function layoutFacility(instanceId: string): FacilityId | null {
  return facilityByInstanceId[instanceId] ?? null;
}

function sourcePoint(locationId: string, index: number): Point2 {
  const facility = layoutFacility(locationId);
  if (facility !== null) return getRoadNode(`${facility}-entrance`).position;
  const habitat = getHabitatPresentationPoints();
  return habitat.departurePoints[index % habitat.departurePoints.length] ?? getRoadNode('habitat-entrance').position;
}

function interpolate(points: readonly Point2[], progress: number, laneOffset: number): AuthoritativeColonistPose {
  const total = Math.max(0.001, getPolylineDistance(points));
  let remaining = Math.min(1, Math.max(0, progress)) * total;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index] ?? points[0] ?? [0, 0];
    const to = points[index + 1] ?? from;
    const length = Math.max(0.001, Math.hypot(to[0] - from[0], to[1] - from[1]));
    if (remaining <= length || index === points.length - 2) {
      const local = Math.min(1, remaining / length);
      const directionX = (to[0] - from[0]) / length;
      const directionZ = (to[1] - from[1]) / length;
      return {
        activity: false,
        animation: 'Walk',
        position: [from[0] + (to[0] - from[0]) * local - directionZ * laneOffset, 0.32, from[1] + (to[1] - from[1]) * local + directionX * laneOffset],
        rotationY: Math.atan2(directionX, directionZ),
        visible: true,
      };
    }
    remaining -= length;
  }
  return { activity: false, animation: 'Walk', position: toWorld(points.at(-1) ?? [0, 0]), rotationY: 0, visible: true };
}

function habitatPose(colonist: ColonistState): AuthoritativeColonistPose {
  const index = stableIndex(colonist.id);
  const points = getHabitatPresentationPoints().restPoints;
  const point = points[index % points.length] ?? getFacilityPlacement('habitat').position;
  return { activity: false, animation: 'Idle', position: toWorld(point), rotationY: index * 0.71 % (Math.PI * 2), visible: true };
}

export function getAuthoritativeColonistPose(colonist: ColonistState): AuthoritativeColonistPose {
  const assignment = colonist.assignment;
  const travel = colonist.travel;
  const index = stableIndex(colonist.id);
  if (travel !== null) {
    const source = sourcePoint(travel.sourceLocationId, index);
    const target = layoutFacility(travel.targetLocationId);
    const road = travel.routeNodeIds.map((nodeId) => getRoadNode(nodeId).position);
    const habitat = getHabitatPresentationPoints();
    const destination = travel.targetLocationId === 'habitat'
      ? habitat.restPoints[index % habitat.restPoints.length] ?? getRoadNode('habitat-entrance').position
      : target === null
        ? road.at(-1) ?? source
        : travel.taskType === 'maintenance'
          ? getFacilityWorkPoint(target)
          : getRoadNode(`${target}-entrance`).position;
    const points = [source, ...road, destination].filter((point, pointIndex, all) => pointIndex === 0 || point[0] !== all[pointIndex - 1]?.[0] || point[1] !== all[pointIndex - 1]?.[1]);
    const progress = travel.durationMinutes === 0 ? 1 : travel.elapsedMinutes / travel.durationMinutes;
    return interpolate(points, progress, (index % 5 - 2) * (travel.purpose === 'return-to-habitat' ? -0.08 : 0.08));
  }
  if (assignment === null) return habitatPose(colonist);
  const target = layoutFacility(assignment.facilityId);
  if (target === null) return habitatPose(colonist);
  if (assignment.phase === 'on-site') {
    if (assignment.taskType === 'maintenance') {
      const point = getFacilityWorkPoint(target);
      const facility = getFacilityPlacement(target).position;
      return { activity: true, animation: 'Idle', position: toWorld(point), rotationY: Math.atan2(facility[0] - point[0], facility[1] - point[1]), visible: true };
    }
    const entrance = getRoadNode(`${target}-entrance`).position;
    return { activity: false, animation: 'Idle', position: toWorld(entrance), rotationY: Math.PI, visible: false };
  }
  return habitatPose(colonist);
}
