export type NavNodeId = 'center' | 'reactor' | 'solar' | 'battery' | 'mine' | 'habitat' | 'oxygen' | 'expansion';

export interface NavNode {
  readonly id: NavNodeId;
  readonly neighbors: readonly NavNodeId[];
  readonly position: readonly [number, number, number];
}

export const NAV_GRAPH: Readonly<Record<NavNodeId, NavNode>> = {
  center: { id: 'center', position: [0, 0.32, 0], neighbors: ['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen', 'expansion'] },
  reactor: { id: 'reactor', position: [-5, 0.32, -0.1], neighbors: ['center', 'habitat'] },
  solar: { id: 'solar', position: [-10, 0.32, 2.7], neighbors: ['center', 'battery'] },
  battery: { id: 'battery', position: [-1, 0.32, 2.9], neighbors: ['center', 'solar', 'oxygen'] },
  mine: { id: 'mine', position: [9, 0.32, -2.7], neighbors: ['center', 'habitat'] },
  habitat: { id: 'habitat', position: [3, 0.32, -1.7], neighbors: ['center', 'reactor', 'mine'] },
  oxygen: { id: 'oxygen', position: [8, 0.32, 2], neighbors: ['center', 'battery', 'expansion'] },
  expansion: { id: 'expansion', position: [13, 0.32, 5], neighbors: ['center', 'oxygen'] },
};

const distance = (a: NavNode, b: NavNode): number => Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);

export function findPath(start: NavNodeId, goal: NavNodeId): readonly NavNodeId[] {
  const open = new Set<NavNodeId>([start]);
  const cameFrom = new Map<NavNodeId, NavNodeId>();
  const gScore = new Map<NavNodeId, number>([[start, 0]]);

  while (open.size > 0) {
    const current = [...open].sort((left, right) => {
      const leftScore = (gScore.get(left) ?? Number.POSITIVE_INFINITY) + distance(NAV_GRAPH[left], NAV_GRAPH[goal]);
      const rightScore = (gScore.get(right) ?? Number.POSITIVE_INFINITY) + distance(NAV_GRAPH[right], NAV_GRAPH[goal]);
      return leftScore - rightScore || left.localeCompare(right);
    })[0];
    if (!current) break;
    if (current === goal) {
      const path: NavNodeId[] = [current];
      let cursor = current;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor) as NavNodeId;
        path.unshift(cursor);
      }
      return path;
    }
    open.delete(current);
    for (const neighbor of NAV_GRAPH[current].neighbors) {
      const tentative = (gScore.get(current) ?? 0) + distance(NAV_GRAPH[current], NAV_GRAPH[neighbor]);
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
}

const destinations: readonly NavNodeId[] = ['reactor', 'solar', 'battery', 'mine', 'oxygen', 'expansion'];

function interpolatePath(path: readonly NavNodeId[], progress: number, state: 'walking-to-facility' | 'walking-to-habitat'): ColonistPose {
  const segmentProgress = progress * Math.max(1, path.length - 1);
  const segment = Math.min(path.length - 2, Math.floor(segmentProgress));
  const from = NAV_GRAPH[path[Math.max(0, segment)] ?? 'habitat'].position;
  const to = NAV_GRAPH[path[Math.max(0, segment + 1)] ?? 'center'].position;
  const local = segmentProgress - segment;
  const x = from[0] + (to[0] - from[0]) * local;
  const z = from[2] + (to[2] - from[2]) * local;
  return { animation: 'Walk', position: [x, from[1], z], rotationY: Math.atan2(to[0] - from[0], to[2] - from[2]), state };
}

export function getColonistPose(index: number, elapsedSeconds: number): ColonistPose {
  const destination = destinations[index % destinations.length] ?? 'habitat';
  const outbound = findPath('habitat', destination);
  const inbound = [...outbound].reverse();
  const cycle = (elapsedSeconds + index * 1.37) % 16;
  if (cycle < 2) {
    return { animation: 'Idle', position: NAV_GRAPH.habitat.position, rotationY: 0, state: 'resting' };
  }
  if (cycle < 2.5) {
    return { animation: 'Idle', position: NAV_GRAPH.habitat.position, rotationY: 0, state: 'assigned' };
  }
  if (cycle < 7.5) return interpolatePath(outbound, (cycle - 2.5) / 5, 'walking-to-facility');
  if (cycle < 10) return { animation: 'Weapon', position: NAV_GRAPH[destination].position, rotationY: Math.PI, state: 'working' };
  if (cycle < 15) return interpolatePath(inbound, (cycle - 10) / 5, 'walking-to-habitat');
  return { animation: 'Idle', position: NAV_GRAPH.habitat.position, rotationY: 0, state: 'resting' };
}
