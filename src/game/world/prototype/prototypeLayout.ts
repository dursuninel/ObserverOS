import { requirePrototypeAsset } from '../assets/prototypeAssetRegistry';
import type { FacilityId } from './types';

export type Point2 = readonly [x: number, z: number];
export type LayoutEntityId = FacilityId | 'expansion';
export type RoadNodeKind = 'approach' | 'entrance' | 'spine';

export interface PrototypeFacilityPlacement {
  readonly id: LayoutEntityId;
  readonly primaryAssetId: string;
  readonly position: Point2;
  readonly rotationY: number;
  readonly footprintOverride?: { readonly depth: number; readonly width: number };
}

export interface PrototypeRoadNode {
  readonly entityId?: LayoutEntityId;
  readonly id: string;
  readonly kind: RoadNodeKind;
  readonly light: boolean;
  readonly position: Point2;
}

export interface PrototypeRoadEdge {
  readonly from: string;
  readonly id: string;
  readonly to: string;
}

const facilities: readonly PrototypeFacilityPlacement[] = [
  { id: 'solar', primaryAssetId: 'solar-panel', position: [-6.5, 3.5], rotationY: Math.PI, footprintOverride: { width: 5, depth: 3 } },
  { id: 'reactor', primaryAssetId: 'reactor-body', position: [-4, -3.6], rotationY: 0 },
  { id: 'battery', primaryAssetId: 'battery-body', position: [-1, 3.6], rotationY: Math.PI },
  { id: 'habitat', primaryAssetId: 'habitat', position: [1.5, -3.6], rotationY: 0 },
  { id: 'oxygen', primaryAssetId: 'oxygen', position: [4.5, 3.6], rotationY: Math.PI },
  { id: 'mine', primaryAssetId: 'mine-drill', position: [7, -3.8], rotationY: 0 },
  { id: 'expansion', primaryAssetId: 'expansion-pad', position: [9.5, 4.3], rotationY: Math.PI },
] as const;

const spineNodes: readonly PrototypeRoadNode[] = [
  { id: 'spine-solar', kind: 'spine', light: true, position: [-6.5, 0] },
  { id: 'spine-reactor', kind: 'spine', light: true, position: [-4, 0] },
  { id: 'spine-battery', kind: 'spine', light: false, position: [-1, 0] },
  { id: 'spine-habitat', kind: 'spine', light: true, position: [1.5, 0] },
  { id: 'spine-oxygen', kind: 'spine', light: false, position: [4.5, 0] },
  { id: 'spine-mine', kind: 'spine', light: true, position: [7, 0] },
  { id: 'spine-expansion', kind: 'spine', light: false, position: [9.5, 0] },
] as const;

function rotateLocalPoint(point: { readonly x: number; readonly z: number }, rotationY: number): Point2 {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [point.x * cosine + point.z * sine, -point.x * sine + point.z * cosine];
}

export function getFacilityPlacement(id: LayoutEntityId): PrototypeFacilityPlacement {
  const placement = facilities.find((candidate) => candidate.id === id);
  if (!placement) throw new Error(`Prototype layout facility "${id}" is missing.`);
  return placement;
}

export function getFacilityFootprint(id: LayoutEntityId): { readonly center: Point2; readonly depth: number; readonly width: number } {
  const placement = getFacilityPlacement(id);
  const asset = requirePrototypeAsset(placement.primaryAssetId);
  const footprint = placement.footprintOverride ?? asset.targetFootprint;
  if (!footprint) throw new Error(`Prototype facility "${id}" has no target footprint.`);
  return { center: placement.position, ...footprint };
}

export function getFacilityEntrance(id: LayoutEntityId): Point2 {
  const placement = getFacilityPlacement(id);
  const asset = requirePrototypeAsset(placement.primaryAssetId);
  if (!asset.entrancePoint) throw new Error(`Prototype facility "${id}" has no entrance point.`);
  const rotated = rotateLocalPoint(asset.entrancePoint, placement.rotationY);
  return [placement.position[0] + rotated[0], placement.position[1] + rotated[1]];
}

export function getFacilityWorkPoint(id: FacilityId): Point2 {
  const placement = getFacilityPlacement(id);
  const asset = requirePrototypeAsset(placement.primaryAssetId);
  if (!asset.workPoint) throw new Error(`Prototype facility "${id}" has no work point.`);
  const rotated = rotateLocalPoint(asset.workPoint, placement.rotationY);
  return [placement.position[0] + rotated[0], placement.position[1] + rotated[1]];
}

const connectionSpine: Readonly<Record<LayoutEntityId, string>> = {
  solar: 'spine-solar', reactor: 'spine-reactor', battery: 'spine-battery', habitat: 'spine-habitat',
  oxygen: 'spine-oxygen', mine: 'spine-mine', expansion: 'spine-expansion',
};

const approachPosition = (id: LayoutEntityId): Point2 => {
  const entrance = getFacilityEntrance(id);
  return [entrance[0], entrance[1] > 0 ? 0.75 : -0.75];
};

const facilityNodes: readonly PrototypeRoadNode[] = facilities.flatMap((facility) => [
  { id: `${facility.id}-approach`, entityId: facility.id, kind: 'approach', light: facility.id !== 'battery' && facility.id !== 'oxygen', position: approachPosition(facility.id) },
  { id: `${facility.id}-entrance`, entityId: facility.id, kind: 'entrance', light: false, position: getFacilityEntrance(facility.id) },
]);

const roadNodes = [...spineNodes, ...facilityNodes] as const;

const spineEdges: readonly PrototypeRoadEdge[] = spineNodes.slice(0, -1).map((node, index) => ({ id: `spine-${index}`, from: node.id, to: spineNodes[index + 1]?.id ?? node.id }));
const facilityEdges: readonly PrototypeRoadEdge[] = facilities.flatMap((facility) => [
  { id: `${facility.id}-service`, from: connectionSpine[facility.id], to: `${facility.id}-approach` },
  { id: `${facility.id}-entrance-link`, from: `${facility.id}-approach`, to: `${facility.id}-entrance` },
]);

export const PROTOTYPE_LAYOUT = {
  camera: { center: [1.5, 0] as Point2, groundCenter: [1.5, 0] as Point2, groundDepth: 16, groundWidth: 24 },
  facilities,
  roadEdges: [...spineEdges, ...facilityEdges] as readonly PrototypeRoadEdge[],
  roadNodes,
  zones: {
    coreCrates: [[-2.7, 2.1, 0.2], [3.2, 2.1, -0.4], [5.6, -2.1, 0.7], [-5.4, -2.1, -0.3]] as const,
    outerRocks: [[-10, -6, 0.5, 0.75], [-10.5, 5.5, 1.4, 0.55], [12, -5.5, 2.2, 0.65], [12.5, 7, 0.2, 0.52], [-1, 7.2, 1.8, 0.48], [3, -7.2, 2.6, 0.5]] as const,
    transitionRocks: [[-8.8, -2.7, 0.4], [-8.5, 2.7, 1.2], [10.7, -1.8, 2.4], [7.5, 7.1, 0.8], [-4.8, 7, 1.7], [-0.8, -7, 2.8]] as const,
  },
} as const;

export function getRoadNode(id: string): PrototypeRoadNode {
  const node = PROTOTYPE_LAYOUT.roadNodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Prototype road node "${id}" is missing.`);
  return node;
}

export function getRoadNeighbors(id: string): readonly string[] {
  return PROTOTYPE_LAYOUT.roadEdges.flatMap((edge) => edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : []).sort();
}

export function getRoadTilePlacements(spacing = 1.25): readonly { readonly position: Point2; readonly rotationY: number }[] {
  const placements = new Map<string, { position: Point2; rotationY: number }>();
  for (const edge of PROTOTYPE_LAYOUT.roadEdges) {
    const from = getRoadNode(edge.from).position;
    const to = getRoadNode(edge.to).position;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const steps = Math.max(1, Math.ceil(length / spacing));
    const rotationY = Math.atan2(to[0] - from[0], to[1] - from[1]);
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const position: Point2 = [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
      const key = `${position[0].toFixed(2)}:${position[1].toFixed(2)}`;
      placements.set(key, { position, rotationY });
    }
  }
  return [...placements.values()];
}

export function getStreetLightPlacements(): readonly Point2[] {
  return PROTOTYPE_LAYOUT.roadNodes.filter((node) => node.light).map((node): Point2 => node.kind === 'spine' ? [node.position[0], node.position[1] + 0.9] : [node.position[0] + 0.9, node.position[1]]);
}

export function segmentIntersectsFootprint(start: Point2, end: Point2, footprint: { readonly center: Point2; readonly depth: number; readonly width: number }, clearance = 0): boolean {
  const minX = footprint.center[0] - footprint.width / 2 - clearance;
  const maxX = footprint.center[0] + footprint.width / 2 + clearance;
  const minZ = footprint.center[1] - footprint.depth / 2 - clearance;
  const maxZ = footprint.center[1] + footprint.depth / 2 + clearance;
  const epsilon = 0.001;
  const isInterior = (point: Point2) => point[0] > minX + epsilon && point[0] < maxX - epsilon && point[1] > minZ + epsilon && point[1] < maxZ - epsilon;
  if (isInterior(start) || isInterior(end)) return true;

  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  let lower = 0;
  let upper = 1;
  for (const [origin, delta, minimum, maximum] of [[start[0], dx, minX, maxX], [start[1], dz, minZ, maxZ]] as const) {
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
