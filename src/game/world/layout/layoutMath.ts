import { CAMERA_OFFSET } from '../prototype/cameraMath';
import type { CameraBounds, GeneratedFacilityPlacement, Point2, Rect2 } from './layoutTypes';

export const distance = (a: Point2, b: Point2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function pointInRect(point: Point2, rect: Rect2, margin = 0): boolean {
  return Math.abs(point[0] - rect.center[0]) <= rect.width / 2 - margin && Math.abs(point[1] - rect.center[1]) <= rect.depth / 2 - margin;
}

export function rectContains(outer: Rect2, inner: Rect2): boolean {
  return pointInRect([inner.center[0] - inner.width / 2, inner.center[1] - inner.depth / 2], outer)
    && pointInRect([inner.center[0] + inner.width / 2, inner.center[1] + inner.depth / 2], outer);
}

export function rectanglesOverlap(a: Rect2, b: Rect2, clearance = 0): boolean {
  return Math.abs(a.center[0] - b.center[0]) < (a.width + b.width) / 2 + clearance
    && Math.abs(a.center[1] - b.center[1]) < (a.depth + b.depth) / 2 + clearance;
}

export function segmentIntersectsRect(start: Point2, end: Point2, rect: Rect2, clearance = 0): boolean {
  const minX = rect.center[0] - rect.width / 2 - clearance;
  const maxX = rect.center[0] + rect.width / 2 + clearance;
  const minZ = rect.center[1] - rect.depth / 2 - clearance;
  const maxZ = rect.center[1] + rect.depth / 2 + clearance;
  const epsilon = 0.001;
  const interior = (value: Point2) => value[0] > minX + epsilon && value[0] < maxX - epsilon && value[1] > minZ + epsilon && value[1] < maxZ - epsilon;
  if (interior(start) || interior(end)) return true;
  const deltas: Point2 = [end[0] - start[0], end[1] - start[1]];
  let lower = 0;
  let upper = 1;
  for (const [origin, delta, minimum, maximum] of [[start[0], deltas[0], minX, maxX], [start[1], deltas[1], minZ, maxZ]] as const) {
    if (Math.abs(delta) < epsilon) {
      if (origin <= minimum + epsilon || origin >= maximum - epsilon) return false;
      continue;
    }
    const first = (minimum - origin) / delta;
    const second = (maximum - origin) / delta;
    lower = Math.max(lower, Math.min(first, second));
    upper = Math.min(upper, Math.max(first, second));
    if (lower >= upper - epsilon) return false;
  }
  return lower < upper - epsilon && upper > epsilon && lower < 1 - epsilon;
}

export function transformLocalPoint(point: Point2, position: Point2, rotationY: number): Point2 {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [position[0] + point[0] * cosine + point[1] * sine, position[1] - point[0] * sine + point[1] * cosine];
}

export interface ProjectedFacility {
  readonly center: Point2;
  readonly depth: number;
  readonly id: string;
  readonly width: number;
}

export function projectFacilitiesHeadless(facilities: readonly GeneratedFacilityPlacement[]): readonly ProjectedFacility[] {
  const horizontalLength = Math.hypot(CAMERA_OFFSET[0], CAMERA_OFFSET[2]);
  const right: Point2 = [CAMERA_OFFSET[2] / horizontalLength, -CAMERA_OFFSET[0] / horizontalLength];
  const groundUp: Point2 = [-CAMERA_OFFSET[0] / horizontalLength, -CAMERA_OFFSET[2] / horizontalLength];
  return facilities.map((facility) => {
    const assetHeight = Math.max(0.7, facility.visualFootprint.depth * 0.28);
    const projectedX = facility.position[0] * right[0] + facility.position[1] * right[1];
    const projectedY = facility.position[0] * groundUp[0] + facility.position[1] * groundUp[1] + assetHeight * 0.75;
    return { id: facility.id, center: [projectedX, projectedY], width: facility.visualFootprint.width * 0.72, depth: facility.visualFootprint.depth * 0.42 + assetHeight * 0.55 };
  });
}

export function projectedOverlapRatio(a: ProjectedFacility, b: ProjectedFacility): number {
  const overlapWidth = Math.max(0, (a.width + b.width) / 2 - Math.abs(a.center[0] - b.center[0]));
  const overlapDepth = Math.max(0, (a.depth + b.depth) / 2 - Math.abs(a.center[1] - b.center[1]));
  const overlap = overlapWidth * overlapDepth;
  return overlap / Math.max(0.001, Math.min(a.width * a.depth, b.width * b.depth));
}

export function deriveCameraBounds(points: readonly Point2[], margin = 3): CameraBounds {
  const xs = points.map((point) => point[0]);
  const zs = points.map((point) => point[1]);
  const minX = Math.min(...xs) - margin;
  const maxX = Math.max(...xs) + margin;
  const minZ = Math.min(...zs) - margin;
  const maxZ = Math.max(...zs) + margin;
  return { center: [(minX + maxX) / 2, (minZ + maxZ) / 2], minX, maxX, minZ, maxZ };
}
