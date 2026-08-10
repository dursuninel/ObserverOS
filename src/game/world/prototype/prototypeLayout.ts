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
  { id: 'solar', primaryAssetId: 'solar-panel', position: [-6.5, 3.5], rotationY: Math.PI },
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

export function transformLocalPointToWorld(point: Point2, placement: Pick<PrototypeFacilityPlacement, 'position' | 'rotationY'>): Point2 {
  const cosine = Math.cos(placement.rotationY);
  const sine = Math.sin(placement.rotationY);
  const rotatedX = point[0] * cosine + point[1] * sine;
  const rotatedZ = -point[0] * sine + point[1] * cosine;
  return [placement.position[0] + rotatedX, placement.position[1] + rotatedZ];
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
  return transformLocalPointToWorld([asset.entrancePoint.x, asset.entrancePoint.z], placement);
}

export function getFacilityWorkPoint(id: FacilityId): Point2 {
  const placement = getFacilityPlacement(id);
  const asset = requirePrototypeAsset(placement.primaryAssetId);
  if (!asset.workPoint) throw new Error(`Prototype facility "${id}" has no work point.`);
  return transformLocalPointToWorld([asset.workPoint.x, asset.workPoint.z], placement);
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
  habitat: {
    localDeparturePoints: [[-0.7, 2.65], [0, 2.82], [0.7, 2.65]] as readonly Point2[],
    localRestPoints: [
      [-2.25, -0.65], [-2.45, 0.15], [-2.35, 1.05], [-2.05, 1.9],
      [-1.45, 2.75], [-0.75, 3.2], [0.1, 3.25], [0.95, 3.18],
      [1.8, 3.12], [2.65, 3], [3.35, 2.6], [3.9, 1.8],
      [4.15, 1], [4.25, 0.15], [4.05, -0.7], [3.55, -1.25],
    ] as readonly Point2[],
    localStagingPoints: [[-0.92, 2.72], [-0.38, 3.02], [0.6, 3.05], [1.48, 2.92]] as readonly Point2[],
  },
  plateauVertices: [
    [-10.8, -4.8], [-8.7, -7], [-4.8, -7.8], [-1.2, -7.4], [2.4, -8.1], [6.5, -7.2],
    [10.9, -6.3], [13.1, -3.2], [12.4, 0.8], [13.3, 4.7], [10.4, 7.2], [6.4, 7.7],
    [2.8, 7.25], [-1.4, 8], [-5.5, 7.1], [-9.3, 6.2], [-11.7, 3.3], [-11.1, -0.7],
  ] as readonly Point2[],
  hazeAnchors: [[-7.5, 4.7], [-3.2, -5.8], [2.2, 6.1], [6.8, -5.4], [10.2, 3.4]] as readonly Point2[],
  zones: {
    coreCrates: [[-2.7, 2.1, 0.2], [3.2, 2.1, -0.4], [-5.4, -2.1, -0.3]] as const,
    outerRocks: [[-10, -6, 0.5, 0.75], [-10.5, 5.5, 1.4, 0.55], [12, -5.5, 2.2, 0.65], [12.5, 7, 0.2, 0.52], [-1, 7.2, 1.8, 0.48], [3, -7.2, 2.6, 0.5]] as const,
    transitionRocks: [[-8.8, -2.7, 0.4], [-8.5, 2.7, 1.2], [10.7, -1.8, 2.4], [7.5, 7.1, 0.8], [-4.8, 7, 1.7], [-0.8, -7, 2.8]] as const,
  },
} as const;

export function getHabitatPresentationPoints(placement: Pick<PrototypeFacilityPlacement, 'position' | 'rotationY'> = getFacilityPlacement('habitat')): {
  readonly departurePoints: readonly Point2[];
  readonly restPoints: readonly Point2[];
  readonly stagingPoints: readonly Point2[];
} {
  return {
    departurePoints: PROTOTYPE_LAYOUT.habitat.localDeparturePoints.map((point) => transformLocalPointToWorld(point, placement)),
    restPoints: PROTOTYPE_LAYOUT.habitat.localRestPoints.map((point) => transformLocalPointToWorld(point, placement)),
    stagingPoints: PROTOTYPE_LAYOUT.habitat.localStagingPoints.map((point) => transformLocalPointToWorld(point, placement)),
  };
}

export function getPrototypeWorldBounds(): { readonly maxX: number; readonly maxZ: number; readonly minX: number; readonly minZ: number } {
  const points: Point2[] = [...PROTOTYPE_LAYOUT.plateauVertices, ...PROTOTYPE_LAYOUT.roadNodes.map((node) => node.position)];
  for (const facility of PROTOTYPE_LAYOUT.facilities) {
    const footprint = getFacilityFootprint(facility.id);
    points.push(
      [footprint.center[0] - footprint.width / 2, footprint.center[1] - footprint.depth / 2],
      [footprint.center[0] + footprint.width / 2, footprint.center[1] + footprint.depth / 2],
    );
  }
  return {
    minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minZ: Math.min(...points.map(([, z]) => z)), maxZ: Math.max(...points.map(([, z]) => z)),
  };
}

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
