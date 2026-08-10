import { pointInRect } from './layoutMath';
import type { Point2, Rect2, TerrainDefinition } from './layoutTypes';

export interface TerrainPathRequest {
  readonly blockedFootprints?: readonly Rect2[];
  readonly cellSize?: number;
  readonly goal: Point2;
  readonly start: Point2;
  readonly terrain: TerrainDefinition;
}

interface SearchNode {
  readonly f: number;
  readonly g: number;
  readonly h: number;
  readonly key: string;
  readonly point: Point2;
}

const keyOf = ([x, z]: Point2): string => `${x.toFixed(4)}:${z.toFixed(4)}`;
const heuristic = (a: Point2, b: Point2): number => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

export function findTerrainPath({ blockedFootprints = [], cellSize = 0.5, goal, start, terrain }: TerrainPathRequest): readonly Point2[] | null {
  const snap = ([x, z]: Point2): Point2 => [Math.round(x / cellSize) * cellSize, Math.round(z / cellSize) * cellSize];
  const snappedStart = snap(start);
  const snappedGoal = snap(goal);
  const blockedAreas = terrain.areas.filter((area) => area.tags.includes('blocked') || area.tags.includes('hazardZone'));
  const isBlocked = (point: Point2) => {
    if (!pointInRect(point, terrain.bounds)) return true;
    if (keyOf(point) === keyOf(snappedStart) || keyOf(point) === keyOf(snappedGoal)) return false;
    return blockedAreas.some((area) => pointInRect(point, area, -0.2)) || blockedFootprints.some((rect) => pointInRect(point, rect, -0.25));
  };
  const startKey = keyOf(snappedStart);
  const goalKey = keyOf(snappedGoal);
  const open: SearchNode[] = [{ f: heuristic(snappedStart, snappedGoal), g: 0, h: heuristic(snappedStart, snappedGoal), key: startKey, point: snappedStart }];
  const best = new Map([[startKey, 0]]);
  const cameFrom = new Map<string, string>();
  const points = new Map<string, Point2>([[startKey, snappedStart]]);
  const directions: readonly Point2[] = [[cellSize, 0], [0, cellSize], [-cellSize, 0], [0, -cellSize]];
  let iterations = 0;

  while (open.length > 0 && iterations < 20_000) {
    iterations += 1;
    open.sort((a, b) => a.f - b.f || a.h - b.h || a.key.localeCompare(b.key));
    const current = open.shift();
    if (!current) break;
    if (current.key === goalKey) {
      const path: Point2[] = [goal];
      let cursor = goalKey;
      while (cursor !== startKey) {
        const previous = cameFrom.get(cursor);
        if (!previous) return null;
        const point = points.get(previous);
        if (point && previous !== startKey) path.push(point);
        cursor = previous;
      }
      path.push(start);
      return path.reverse();
    }
    for (const direction of directions) {
      const next: Point2 = [current.point[0] + direction[0], current.point[1] + direction[1]];
      if (isBlocked(next)) continue;
      const nextKey = keyOf(next);
      const nextG = current.g + cellSize;
      if (nextG >= (best.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
      const h = heuristic(next, snappedGoal);
      best.set(nextKey, nextG);
      cameFrom.set(nextKey, current.key);
      points.set(nextKey, next);
      open.push({ f: nextG + h, g: nextG, h, key: nextKey, point: next });
    }
  }
  return null;
}

export function simplifyPath(path: readonly Point2[]): readonly Point2[] {
  if (path.length <= 2) return path;
  const simplified: Point2[] = [path[0] ?? [0, 0]];
  for (let index = 1; index < path.length - 1; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const next = path[index + 1];
    if (!previous || !current || !next) continue;
    const firstDirection = [Math.sign(current[0] - previous[0]), Math.sign(current[1] - previous[1])];
    const secondDirection = [Math.sign(next[0] - current[0]), Math.sign(next[1] - current[1])];
    if (firstDirection[0] !== secondDirection[0] || firstDirection[1] !== secondDirection[1]) simplified.push(current);
  }
  simplified.push(path.at(-1) ?? [0, 0]);
  return simplified;
}
