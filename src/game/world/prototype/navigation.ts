import { getRoadNeighbors, getRoadNode, PROTOTYPE_LAYOUT, type Point2 } from './prototypeLayout';

const distance = (left: Point2, right: Point2): number => Math.hypot(left[0] - right[0], left[1] - right[1]);

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

export type ColonistPresentationState = 'assigned' | 'resting' | 'walking-to-facility' | 'walking-to-habitat' | 'working';

export interface ColonistPose {
  readonly animation: 'Idle' | 'Walk' | 'Weapon';
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly state: ColonistPresentationState;
  readonly visible: boolean;
}

const destinations = ['reactor', 'solar', 'battery', 'mine', 'oxygen'] as const;

function nodePosition(id: string): readonly [number, number, number] {
  const [x, z] = getRoadNode(id).position;
  return [x, 0.32, z];
}

function interpolatePath(path: readonly string[], progress: number, state: 'walking-to-facility' | 'walking-to-habitat', laneOffset: number): ColonistPose {
  const segmentProgress = progress * Math.max(1, path.length - 1);
  const segment = Math.min(path.length - 2, Math.floor(segmentProgress));
  const from = nodePosition(path[Math.max(0, segment)] ?? 'habitat-entrance');
  const to = nodePosition(path[Math.max(0, segment + 1)] ?? 'habitat-entrance');
  const local = segmentProgress - segment;
  const x = from[0] + (to[0] - from[0]) * local;
  const z = from[2] + (to[2] - from[2]) * local;
  const length = Math.max(0.001, Math.hypot(to[0] - from[0], to[2] - from[2]));
  const lateralX = -(to[2] - from[2]) / length * laneOffset;
  const lateralZ = (to[0] - from[0]) / length * laneOffset;
  return { animation: 'Walk', position: [x + lateralX, from[1], z + lateralZ], rotationY: Math.atan2(to[0] - from[0], to[2] - from[2]), state, visible: true };
}

export function getColonistPose(index: number, elapsedSeconds: number): ColonistPose {
  const destination = destinations[index % destinations.length] ?? 'reactor';
  const startNode = 'habitat-entrance';
  const destinationNode = `${destination}-entrance`;
  const outbound = findPath(startNode, destinationNode);
  const inbound = [...outbound].reverse();
  const cycle = (elapsedSeconds + index * 1.37) % 16;
  const laneOffset = ((index % 5) - 2) * 0.12;
  const habitatEntrance = nodePosition(startNode);
  if (cycle < 2) {
    return { animation: 'Idle', position: [habitatEntrance[0] + laneOffset, habitatEntrance[1], habitatEntrance[2] - 0.35], rotationY: 0, state: 'resting', visible: true };
  }
  if (cycle < 2.5) {
    return { animation: 'Idle', position: habitatEntrance, rotationY: 0, state: 'assigned', visible: true };
  }
  if (cycle < 7.5) return interpolatePath(outbound, (cycle - 2.5) / 5, 'walking-to-facility', laneOffset);
  if (cycle < 10) return { animation: 'Weapon', position: nodePosition(destinationNode), rotationY: Math.PI, state: 'working', visible: false };
  if (cycle < 15) return interpolatePath(inbound, (cycle - 10) / 5, 'walking-to-habitat', laneOffset);
  return { animation: 'Idle', position: habitatEntrance, rotationY: 0, state: 'resting', visible: true };
}

export function allRoadNodeIds(): readonly string[] {
  return PROTOTYPE_LAYOUT.roadNodes.map((node) => node.id);
}
