import { getFacilityPlacement, getFacilityWorkPoint, getRoadNeighbors, getRoadNode, PROTOTYPE_LAYOUT, type Point2 } from './prototypeLayout';

const distance = (left: Point2, right: Point2): number => Math.hypot(left[0] - right[0], left[1] - right[1]);

function seededUnit(index: number, salt: number): number {
  let value = (index + 11) * 0x9e3779b1 ^ salt * 0x85ebca6b;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

export function findPath(start: string, goal: string): readonly string[] {
  const open = new Set<string>([start]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[start, 0]]);
  while (open.size > 0) {
    const current = [...open].sort((left, right) => {
      const leftScore = (gScore.get(left) ?? Number.POSITIVE_INFINITY) + distance(getRoadNode(left).position, getRoadNode(goal).position);
      const rightScore = (gScore.get(right) ?? Number.POSITIVE_INFINITY) + distance(getRoadNode(right).position, getRoadNode(goal).position);
      return leftScore - rightScore || left.localeCompare(right);
    })[0];
    if (!current) break;
    if (current === goal) {
      const path = [current];
      let cursor = current;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor) as string;
        path.unshift(cursor);
      }
      return path;
    }
    open.delete(current);
    for (const neighbor of getRoadNeighbors(current)) {
      const tentative = (gScore.get(current) ?? 0) + distance(getRoadNode(current).position, getRoadNode(neighbor).position);
      if (tentative < (gScore.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentative);
        open.add(neighbor);
      }
    }
  }
  return [];
}

export type CharacterAnimation = 'Idle' | 'Walk';
export type ColonistPresentationState = 'assigned' | 'resting' | 'walking-to-facility' | 'walking-to-habitat' | 'working';

export interface ColonistPose {
  readonly animation: CharacterAnimation;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly state: ColonistPresentationState;
  readonly visible: boolean;
}

export interface ColonistSchedule {
  readonly assignmentDuration: number;
  readonly cycleDuration: number;
  readonly destination: 'battery' | 'mine' | 'oxygen' | 'reactor' | 'solar';
  readonly inboundDistance: number;
  readonly inboundDuration: number;
  readonly laneOffset: number;
  readonly outboundDistance: number;
  readonly outboundDuration: number;
  readonly phaseOffset: number;
  readonly restDuration: number;
  readonly restPointIndex: number;
  readonly stagingPointIndex: number;
  readonly walkingSpeed: number;
  readonly workingDuration: number;
}

const destinations = ['reactor', 'solar', 'battery', 'mine', 'oxygen'] as const;
const laneOffsets = [-0.24, -0.16, -0.08, 0.08, 0.16, 0.24] as const;

const toWorld = ([x, z]: Point2): readonly [number, number, number] => [x, 0.32, z];
const roadPathPoints = (ids: readonly string[]): readonly Point2[] => ids.map((id) => getRoadNode(id).position);

export function getPolylineDistance(points: readonly Point2[]): number {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index] ?? point, point), 0);
}

function getPresentationPaths(index: number, destination: ColonistSchedule['destination']): { readonly inbound: readonly Point2[]; readonly outbound: readonly Point2[] } {
  const restPoint = PROTOTYPE_LAYOUT.habitat.restPoints[(index * 7) % PROTOTYPE_LAYOUT.habitat.restPoints.length] ?? PROTOTYPE_LAYOUT.habitat.restPoints[0] ?? [1.5, -1];
  const stagingPoint = PROTOTYPE_LAYOUT.habitat.stagingPoints[(index * 5 + 1) % PROTOTYPE_LAYOUT.habitat.stagingPoints.length] ?? [1.5, -1];
  const road = roadPathPoints(findPath('habitat-entrance', `${destination}-entrance`));
  return { outbound: [stagingPoint, ...road], inbound: [...road].reverse().concat([restPoint]) };
}

export function getColonistSchedule(index: number): ColonistSchedule {
  const destination = destinations[(index * 3 + Math.floor(seededUnit(index, 1) * destinations.length)) % destinations.length] ?? 'reactor';
  const paths = getPresentationPaths(index, destination);
  const walkingSpeed = 0.9 + seededUnit(index, 2) * 0.32;
  const outboundDistance = getPolylineDistance(paths.outbound);
  const inboundDistance = getPolylineDistance(paths.inbound);
  const restDuration = 2.4 + seededUnit(index, 3) * 4.8;
  const assignmentDuration = 0.45 + seededUnit(index, 4) * 0.75;
  const workingDuration = 2.8 + seededUnit(index, 5) * 5.2;
  const outboundDuration = outboundDistance / walkingSpeed;
  const inboundDuration = inboundDistance / walkingSpeed;
  const cycleDuration = restDuration + assignmentDuration + outboundDuration + workingDuration + inboundDuration;
  return {
    assignmentDuration, cycleDuration, destination, inboundDistance, inboundDuration,
    laneOffset: laneOffsets[index % laneOffsets.length] ?? 0.08,
    outboundDistance, outboundDuration, phaseOffset: seededUnit(index, 6) * cycleDuration,
    restDuration, restPointIndex: (index * 7) % PROTOTYPE_LAYOUT.habitat.restPoints.length,
    stagingPointIndex: (index * 5 + 1) % PROTOTYPE_LAYOUT.habitat.stagingPoints.length,
    walkingSpeed, workingDuration,
  };
}

function interpolatePolyline(points: readonly Point2[], progress: number, state: 'walking-to-facility' | 'walking-to-habitat', laneOffset: number): ColonistPose {
  const totalDistance = Math.max(0.001, getPolylineDistance(points));
  let remaining = Math.min(1, Math.max(0, progress)) * totalDistance;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index] ?? points[0] ?? [0, 0];
    const to = points[index + 1] ?? from;
    const segmentLength = Math.max(0.001, distance(from, to));
    if (remaining <= segmentLength || index === points.length - 2) {
      const local = Math.min(1, remaining / segmentLength);
      const directionX = (to[0] - from[0]) / segmentLength;
      const directionZ = (to[1] - from[1]) / segmentLength;
      return {
        animation: 'Walk',
        position: [from[0] + (to[0] - from[0]) * local - directionZ * laneOffset, 0.32, from[1] + (to[1] - from[1]) * local + directionX * laneOffset],
        rotationY: Math.atan2(directionX, directionZ), state, visible: true,
      };
    }
    remaining -= segmentLength;
  }
  return { animation: 'Walk', position: toWorld(points.at(-1) ?? [0, 0]), rotationY: 0, state, visible: true };
}

export function getColonistPose(index: number, elapsedSeconds: number): ColonistPose {
  const schedule = getColonistSchedule(index);
  const paths = getPresentationPaths(index, schedule.destination);
  const cycle = (elapsedSeconds + schedule.phaseOffset) % schedule.cycleDuration;
  const restPoint = PROTOTYPE_LAYOUT.habitat.restPoints[schedule.restPointIndex] ?? [1.5, -1];
  const stagingPoint = PROTOTYPE_LAYOUT.habitat.stagingPoints[schedule.stagingPointIndex] ?? [1.5, -1];
  let cursor = schedule.restDuration;
  if (cycle < cursor) return { animation: 'Idle', position: toWorld(restPoint), rotationY: seededUnit(index, 7) * Math.PI * 2, state: 'resting', visible: true };
  cursor += schedule.assignmentDuration;
  if (cycle < cursor) return { animation: 'Idle', position: toWorld(stagingPoint), rotationY: 0, state: 'assigned', visible: true };
  cursor += schedule.outboundDuration;
  if (cycle < cursor) return interpolatePolyline(paths.outbound, (cycle - cursor + schedule.outboundDuration) / schedule.outboundDuration, 'walking-to-facility', schedule.laneOffset);
  cursor += schedule.workingDuration;
  if (cycle < cursor) return { animation: 'Idle', position: toWorld(getRoadNode(`${schedule.destination}-entrance`).position), rotationY: Math.PI, state: 'working', visible: false };
  return interpolatePolyline(paths.inbound, (cycle - cursor) / schedule.inboundDuration, 'walking-to-habitat', -schedule.laneOffset);
}

export type MaintenancePresentationState = 'resting' | 'walking-to-facility' | 'working' | 'walking-to-habitat';

export interface MaintenancePose extends ColonistPose {
  readonly activity: boolean;
  readonly state: MaintenancePresentationState;
}

export function getMaintenanceCycleDuration(facility: 'mine' | 'reactor'): number {
  const path = roadPathPoints(findPath('habitat-entrance', `${facility}-entrance`));
  const workPoint = getFacilityWorkPoint(facility);
  const travel = getPolylineDistance([...path, workPoint]);
  return 1.2 + travel / 1.05 + 5.2 + travel / 1.05 + 1.8;
}

export function getMaintenancePose(facility: 'mine' | 'reactor', elapsedSeconds: number): MaintenancePose {
  const path = roadPathPoints(findPath('habitat-entrance', `${facility}-entrance`));
  const workPoint = getFacilityWorkPoint(facility);
  const outbound = [PROTOTYPE_LAYOUT.habitat.departurePoints[1] ?? [1.5, -1], ...path, workPoint] as readonly Point2[];
  const inbound = [...outbound].reverse();
  const travelDuration = getPolylineDistance(outbound) / 1.05;
  const cycleDuration = 1.2 + travelDuration + 5.2 + travelDuration + 1.8;
  const cycle = elapsedSeconds % cycleDuration;
  if (cycle < 1.2) return { activity: false, animation: 'Idle', position: toWorld(outbound[0] ?? [1.5, -1]), rotationY: 0, state: 'resting', visible: true };
  if (cycle < 1.2 + travelDuration) return { ...interpolatePolyline(outbound, (cycle - 1.2) / travelDuration, 'walking-to-facility', 0.18), activity: false, state: 'walking-to-facility' };
  if (cycle < 6.4 + travelDuration) {
    const placement = getFacilityPlacement(facility).position;
    return { activity: true, animation: 'Idle', position: [workPoint[0] + Math.sin(cycle * 1.3) * 0.08, 0.32, workPoint[1]], rotationY: Math.atan2(placement[0] - workPoint[0], placement[1] - workPoint[1]), state: 'working', visible: true };
  }
  if (cycle < 6.4 + travelDuration * 2) return { ...interpolatePolyline(inbound, (cycle - 6.4 - travelDuration) / travelDuration, 'walking-to-habitat', -0.18), activity: false, state: 'walking-to-habitat' };
  return { activity: false, animation: 'Idle', position: toWorld(outbound[0] ?? [1.5, -1]), rotationY: 0, state: 'resting', visible: true };
}

export const PROTOTYPE_REQUIRED_CHARACTER_CLIPS = ['Idle', 'Walk'] as const;

export function validatePrototypeCharacterClips(clips: readonly string[]): readonly string[] {
  return PROTOTYPE_REQUIRED_CHARACTER_CLIPS.filter((clip) => !clips.includes(clip));
}

export function getPrototypeCharacterAssetId(index: number): 'prototype-astronaut' | 'prototype-astronaut-barbara' | 'prototype-astronaut-rae' {
  return (['prototype-astronaut', 'prototype-astronaut-rae', 'prototype-astronaut-barbara'] as const)[index % 3] ?? 'prototype-astronaut';
}

export function allRoadNodeIds(): readonly string[] {
  return PROTOTYPE_LAYOUT.roadNodes.map((node) => node.id);
}
