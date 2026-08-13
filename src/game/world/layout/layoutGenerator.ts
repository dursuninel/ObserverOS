import { requirePrototypeAsset } from '../assets/prototypeAssetRegistry';
import type { FacilityId } from '../prototype/types';
import {
  FACILITY_PLAN_ORDER,
  SPINE_ENTITY_ORDER,
  isJunctionNodeId,
  materializeArchetype,
  spineNodeId,
  type FacilityPlacementPlan,
  type MaterializedArchetype,
  type PlateauPlan,
  type StreetLightPlan,
} from './archetypeVariation';
import { createDeterministicRng, hashSeed, type DeterministicRng } from './deterministicRng';
import { deriveCameraBounds, distance, pointInRect, rectContains, rectanglesOverlap, segmentIntersectsRect, transformLocalPoint } from './layoutMath';
import { scoreGeneratedLayout, totalLayoutScore } from './layoutScoring';
import { validateGeneratedLayout } from './layoutValidation';
import {
  GENERATOR_VERSION,
  INTERNAL_CANDIDATE_COUNT,
  NIVALIS_ANCHOR_SPREAD,
  NIVALIS_FACILITY_ASSETS,
  NIVALIS_LAYOUT_INTENT,
  NIVALIS_PLACEMENT_PROFILES,
  NIVALIS_TERRAIN,
  VISUAL_CANDIDATE_COUNT,
} from './nivalisLayoutIntent';
import { STRUCTURAL_ARCHETYPES, type StructuralArchetype } from './structuralArchetypes';
import { findTerrainPath, simplifyPath } from './terrainPathfinding';
import { getVisualCompound, type VisualCompoundProfile } from './visualCompoundProfiles';
import type {
  GeneratedExpansionSlot,
  GeneratedFacilityPlacement,
  GeneratedPlanetLayout,
  GeneratedRoad,
  HabitatVisualVariantId,
  LayoutEntityId,
  LayoutGenerationResult,
  LayoutScoreBreakdown,
  LayoutStyle,
  NavigationEdge,
  NavigationNode,
  Point2,
  PropZone,
  Rect2,
  StreetLightPlacement,
  StructuralArchetypeId,
  TerrainDefinition,
  TerrainVisualVariantId,
} from './layoutTypes';

const EMPTY_SCORE: LayoutScoreBreakdown = Object.freeze({ adjacency: 0, cameraReadability: 0, compactness: 0, expansionAccess: 0, roadQuality: 0, safetySeparation: 0, screenSpaceOverlap: 0, terrainUsage: 0, visualComposition: 0 });
const FACILITY_ORDER: readonly FacilityId[] = FACILITY_PLAN_ORDER;
const ROUTE_ORDER: readonly LayoutEntityId[] = SPINE_ENTITY_ORDER;
const DIVERSITY_THRESHOLD = 0.32;
const MAXIMUM_STREET_LIGHTS = 30;
const MATERIALIZATION_ATTEMPTS = 4;
const RETRY_RELIEF_THRESHOLD = 2;
const round = (value: number) => Number(value.toFixed(3));
const point = (x: number, z: number): Point2 => [round(x), round(z)];

export interface GenerateLayoutOptions {
  readonly internalCandidateCount?: number;
  readonly seed: number | string;
  readonly style?: LayoutStyle;
  readonly terrain?: TerrainDefinition;
  readonly visualCandidateCount?: number;
}

function normalizedToWorld(normalized: Point2, terrain: TerrainDefinition): Point2 {
  return point(terrain.bounds.center[0] + normalized[0] * terrain.bounds.width * NIVALIS_ANCHOR_SPREAD, terrain.bounds.center[1] + normalized[1] * terrain.bounds.depth * NIVALIS_ANCHOR_SPREAD);
}

function rotatedAabb(width: number, depth: number, rotationY: number): { readonly depth: number; readonly width: number } {
  const cosine = Math.abs(Math.cos(rotationY));
  const sine = Math.abs(Math.sin(rotationY));
  return { width: round(width * cosine + depth * sine), depth: round(width * sine + depth * cosine) };
}

function zoneForFacility(id: FacilityId, terrain: TerrainDefinition) {
  const profile = NIVALIS_PLACEMENT_PROFILES[id];
  if (id === 'mine') return terrain.areas.find((area) => area.tags.includes('resourceZone'));
  return terrain.areas.find((area) => area.operationalZone !== undefined && profile.preferredZones.includes(area.operationalZone));
}

export interface ZoneAnchorOptions {
  readonly columns?: number;
  readonly jitter?: number;
  readonly rows?: number;
  /** Sub-window of the zone the grid is laid out in; `scale` 1 with a centred origin is the full zone. */
  readonly window?: { readonly center: Point2; readonly scale: number };
}

export function generateZoneAnchors(area: Rect2, footprint: { readonly depth: number; readonly width: number }, rng: DeterministicRng, options: ZoneAnchorOptions = {}): readonly Point2[] {
  const columns = Math.max(2, Math.floor(options.columns ?? 5));
  const rows = Math.max(2, Math.floor(options.rows ?? 4));
  const jitter = options.jitter ?? 0.38;
  const windowScale = Math.min(1, Math.max(0.2, options.window?.scale ?? 1));
  const windowCenter = options.window?.center ?? [0, 0];
  const fullWidth = Math.max(0, area.width - footprint.width - 1.2);
  const fullDepth = Math.max(0, area.depth - footprint.depth - 1.2);
  const usableWidth = fullWidth * windowScale;
  const usableDepth = fullDepth * windowScale;
  const centerX = area.center[0] + windowCenter[0] * (fullWidth - usableWidth) / 2;
  const centerZ = area.center[1] + windowCenter[1] * (fullDepth - usableDepth) / 2;
  const anchors: Point2[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const x = centerX - usableWidth / 2 + usableWidth * column / Math.max(1, columns - 1);
    const z = centerZ - usableDepth / 2 + usableDepth * row / Math.max(1, rows - 1);
    anchors.push(point(x + rng.range(-jitter, jitter), z + rng.range(-jitter, jitter)));
  }
  return anchors;
}

function facilityRotation(anchor: Point2, roadTarget: Point2, plan: FacilityPlacementPlan): number {
  const roadFacing = Math.atan2(roadTarget[0] - anchor[0], roadTarget[1] - anchor[1]);
  const delta = plan.rotationQuantum === 0 ? 0 : Math.round(plan.rotationOffset / plan.rotationQuantum) * plan.rotationQuantum;
  return Number((roadFacing + delta).toFixed(4));
}

interface AnchorChoice {
  readonly anchor: Point2;
  readonly rotationY: number;
}

function chooseFacilityAnchor(id: FacilityId, compound: VisualCompoundProfile, roadTarget: Point2, plan: FacilityPlacementPlan, mainRoads: readonly GeneratedRoad[], placed: readonly GeneratedFacilityPlacement[], terrain: TerrainDefinition, rng: DeterministicRng): AnchorChoice | null {
  const area = zoneForFacility(id, terrain);
  if (!area) return null;
  const profile = NIVALIS_PLACEMENT_PROFILES[id];
  const expected: Point2 = [roadTarget[0], roadTarget[1] + plan.side * (compound.depth / 2 + plan.approachDistance)];
  const buildable = terrain.areas.find((candidate) => candidate.id === 'buildable-plateau') ?? terrain.bounds;
  const forbidden = terrain.areas.filter((candidate) => candidate.tags.includes('blocked') || candidate.tags.includes('hazardZone'));
  const structuralRadius = (Math.max(compound.width, compound.depth) / 2 + 2.6) * plan.ringRadiusScale;
  const structuralAnchors = Array.from({ length: plan.ringCount }, (_unused, index) => {
    const angle = plan.ringStartAngle + index * Math.PI * 2 / plan.ringCount;
    return point(roadTarget[0] + Math.cos(angle) * structuralRadius + rng.range(-0.4, 0.4), roadTarget[1] + Math.sin(angle) * structuralRadius + rng.range(-0.4, 0.4));
  });
  const zoneAnchors = generateZoneAnchors(area, { width: compound.width, depth: compound.depth }, rng, {
    columns: plan.gridColumns, jitter: plan.gridJitter, rows: plan.gridRows,
    window: { center: plan.sampleWindowCenter, scale: plan.sampleWindowScale },
  });
  const candidates = [...structuralAnchors, ...zoneAnchors]
    .map((anchor) => ({ anchor, score: distance(anchor, expected) + rng.range(0, plan.explorationNoise) }))
    .sort((a, b) => a.score - b.score || a.anchor[0] - b.anchor[0] || a.anchor[1] - b.anchor[1]);
  const accepted = candidates.find(({ anchor }) => {
    const rotationY = facilityRotation(anchor, roadTarget, plan);
    const footprint: Rect2 = { center: anchor, ...rotatedAabb(compound.width, compound.depth, rotationY) };
    return pointInRect(anchor, area)
      && rectContains(buildable, footprint)
      && forbidden.every((blocked) => !rectanglesOverlap(footprint, blocked))
      && profile.avoidedNeighbours.every((rule) => {
        const other = placed.find((facility) => facility.id === rule.facilityId);
        return !other || rule.minDistance === undefined || distance(anchor, other.position) > rule.minDistance;
      })
      && mainRoads.every((road) => road.points.slice(1).every((end, index) => !segmentIntersectsRect(road.points[index] ?? end, end, footprint, 0.2)))
      && placed.every((facility) => !rectanglesOverlap(footprint, facility.visualFootprint, 0.7));
  });
  if (!accepted) return null;
  return { anchor: accepted.anchor, rotationY: facilityRotation(accepted.anchor, roadTarget, plan) };
}

function createFacility(id: FacilityId, position: Point2, rotationY: number, compound: VisualCompoundProfile): GeneratedFacilityPlacement {
  const primaryAssetId = NIVALIS_FACILITY_ASSETS[id];
  const asset = requirePrototypeAsset(primaryAssetId);
  if (!asset.targetFootprint || !asset.entrancePoint || !asset.workPoint) throw new Error(`AssetRegistry geometry is incomplete for ${primaryAssetId}.`);
  const entrance = transformLocalPoint([asset.entrancePoint.x, asset.entrancePoint.z], position, rotationY);
  const workPoint = transformLocalPoint([asset.workPoint.x, asset.workPoint.z], position, rotationY);
  const physicalBounds = rotatedAabb(asset.targetFootprint.width, asset.targetFootprint.depth, rotationY);
  const visualBounds = rotatedAabb(compound.width, compound.depth, rotationY);
  return {
    id, primaryAssetId, position, rotationY,
    entrance: point(entrance[0], entrance[1]), workPoint: point(workPoint[0], workPoint[1]),
    footprint: { center: position, ...physicalBounds }, visualFootprint: { center: position, ...visualBounds },
    visualVariantId: compound.id, visualModules: compound.modules,
    serviceClearance: NIVALIS_PLACEMENT_PROFILES[id].serviceClearance,
  };
}

function expansionAreaFor(relation: StructuralArchetype['expansionRelation'], terrain: TerrainDefinition) {
  const suffix = relation.startsWith('east') ? 'east' : relation.startsWith('west') ? 'west' : relation.startsWith('north') ? 'north' : 'south';
  return terrain.areas.find((area) => area.id === `expansion-${suffix}`);
}

function createExpansion(materialized: MaterializedArchetype, terrain: TerrainDefinition, roadTarget: Point2, facilities: readonly GeneratedFacilityPlacement[], rng: DeterministicRng): GeneratedExpansionSlot | null {
  const area = expansionAreaFor(materialized.expansionRelation, terrain);
  if (!area) return null;
  const anchors = [...generateZoneAnchors(area, { width: 5, depth: 5 }, rng)]
    .map((anchor) => ({ anchor, score: distance(anchor, roadTarget) + rng.range(0, 1.4) }))
    .sort((a, b) => a.score - b.score || a.anchor[0] - b.anchor[0]);
  const position = anchors.find(({ anchor }) => facilities.every((facility) => !rectanglesOverlap(facility.visualFootprint, { center: anchor, width: 5, depth: 5 }, 2.5)))?.anchor;
  if (!position) return null;
  const rotationY = Math.atan2(roadTarget[0] - position[0], roadTarget[1] - position[1]);
  return { id: 'expansion', primaryAssetId: 'expansion-pad', position, rotationY, footprintCapacity: { width: 5, depth: 5 }, compatibility: ['standard-buffer-module'], accessNodeId: 'expansion-entrance' };
}

function spinePositions(materialized: MaterializedArchetype, terrain: TerrainDefinition): ReadonlyMap<string, Point2> {
  const positions = new Map<string, Point2>();
  for (const entity of ROUTE_ORDER) positions.set(spineNodeId(entity), normalizedToWorld(materialized.anchors[entity], terrain));
  for (const junction of materialized.junctions) positions.set(junction.id, normalizedToWorld(junction.position, terrain));
  return positions;
}

function buildMainRoadGeometry(materialized: MaterializedArchetype, terrain: TerrainDefinition): readonly GeneratedRoad[] {
  const positions = spinePositions(materialized, terrain);
  return materialized.segments.flatMap((segment) => {
    const start = positions.get(segment.from);
    const goal = positions.get(segment.to);
    if (!start || !goal) return [];
    return [{ edgeId: segment.edgeId, role: 'main-spine' as const, points: simplifyPath([start, ...segment.waypoints.map((waypoint) => normalizedToWorld(waypoint, terrain)), goal]) }];
  });
}

function buildSpatialGraph(facilities: readonly GeneratedFacilityPlacement[], expansion: GeneratedExpansionSlot, materialized: MaterializedArchetype, terrain: TerrainDefinition): { readonly edges: readonly NavigationEdge[]; readonly nodes: readonly NavigationNode[]; readonly roads: readonly GeneratedRoad[] } | null {
  const positions = spinePositions(materialized, terrain);
  const entranceById = Object.fromEntries([...facilities.map((facility) => [facility.id, facility.entrance] as const), ['expansion', transformLocalPoint([0, 2.8], expansion.position, expansion.rotationY)]]) as Record<LayoutEntityId, Point2>;
  const entitySpineNodes: NavigationNode[] = ROUTE_ORDER.flatMap((id) => {
    const position = positions.get(spineNodeId(id));
    return position ? [{ id: spineNodeId(id), entityId: id, kind: 'spine' as const, position }] : [];
  });
  const junctionNodes: NavigationNode[] = materialized.junctions.flatMap((junction) => {
    const position = positions.get(junction.id);
    return position ? [{ id: junction.id, kind: 'spine' as const, position }] : [];
  });
  const accessNodes: NavigationNode[] = ROUTE_ORDER.flatMap((id) => {
    const entrance = entranceById[id];
    const spine = positions.get(spineNodeId(id));
    if (!entrance || !spine) return [];
    const length = Math.max(0.001, distance(entrance, spine));
    const approach = point(entrance[0] + (spine[0] - entrance[0]) / length * 0.85, entrance[1] + (spine[1] - entrance[1]) / length * 0.85);
    return [{ id: `${id}-approach`, entityId: id, kind: 'approach' as const, position: approach }, { id: `${id}-entrance`, entityId: id, kind: 'entrance' as const, position: entrance }];
  });
  const nodes = [...entitySpineNodes, ...junctionNodes, ...accessNodes];
  const edges: NavigationEdge[] = [
    ...materialized.segments.map((segment) => ({ id: segment.edgeId, from: segment.from, to: segment.to, role: 'main-spine' as const })),
    ...ROUTE_ORDER.flatMap((id) => [{ id: `${id}-service`, from: spineNodeId(id), to: `${id}-approach`, role: 'service' as const }, { id: `${id}-entrance-link`, from: `${id}-approach`, to: `${id}-entrance`, role: 'entrance-link' as const }]),
  ];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const mainRoads = buildMainRoadGeometry(materialized, terrain);
  const roads: GeneratedRoad[] = [];
  for (const edge of edges) {
    const start = nodeById.get(edge.from)?.position;
    const goal = nodeById.get(edge.to)?.position;
    if (!start || !goal) return null;
    let rawPath: readonly Point2[] | null = [start, goal];
    if (edge.role === 'main-spine') {
      rawPath = mainRoads.find((road) => road.edgeId === edge.id)?.points ?? null;
    } else if (edge.role === 'service') {
      const targetId = edge.to.replace('-approach', '');
      // Foreign compounds are avoided wholesale; the target's own core still blocks the path so a
      // service road approaches the entrance from outside instead of cutting across the building.
      const compoundObstacles = facilities.filter((facility) => facility.id !== targetId).map((facility) => ({ id: `compound-obstacle-${facility.id}`, center: facility.visualFootprint.center, width: facility.visualFootprint.width + 0.4, depth: facility.visualFootprint.depth + 0.4, tags: ['blocked' as const] }));
      rawPath = findTerrainPath({ start, goal, terrain: { ...terrain, areas: [...terrain.areas, ...compoundObstacles] } });
    }
    if (!rawPath) return null;
    roads.push({ edgeId: edge.id, role: edge.role, points: simplifyPath(rawPath) });
  }
  return { nodes, edges, roads };
}

function mainSpineDegrees(edges: readonly NavigationEdge[]): ReadonlyMap<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    if (edge.role !== 'main-spine') continue;
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
  }
  return degrees;
}

function polylineLength(points: readonly Point2[]): number {
  return points.slice(1).reduce((sum, current, index) => sum + distance(points[index] ?? current, current), 0);
}

function sampleAlongPolyline(points: readonly Point2[], target: number): { readonly normal: Point2; readonly position: Point2 } | null {
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;
    const segment = distance(start, end);
    if (segment < 0.001) continue;
    if (travelled + segment >= target) {
      const ratio = (target - travelled) / segment;
      return {
        normal: [-(end[1] - start[1]) / segment, (end[0] - start[0]) / segment],
        position: [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio],
      };
    }
    travelled += segment;
  }
  return null;
}

// Lighting is a rhythm derived from the concrete road graph, not a fixed offset table: the spacing,
// the lateral side, the node offsets and which facility approaches get a lamp are all per seed.
function deriveStreetLights(nodes: readonly NavigationNode[], edges: readonly NavigationEdge[], roads: readonly GeneratedRoad[], plan: StreetLightPlan, rng: DeterministicRng): readonly StreetLightPlacement[] {
  const degrees = mainSpineDegrees(edges);
  const raw: StreetLightPlacement[] = [];
  nodes.filter((node) => node.kind === 'spine').forEach((node, index) => {
    const junction = isJunctionNodeId(node.id) || (degrees.get(node.id) ?? 0) >= 3;
    if (!junction && index % 2 !== 0) return;
    const angle = plan.nodeOffsetAngle + index * 1.7;
    raw.push({ id: `light-${node.id}`, roadNodeId: node.id, reason: junction ? 'junction' : 'intermediate', position: point(node.position[0] + Math.cos(angle) * plan.nodeOffsetRadius, node.position[1] + Math.sin(angle) * plan.nodeOffsetRadius) });
  });
  nodes.filter((node) => node.kind === 'approach' && plan.approachEntities.includes(node.entityId as FacilityId)).forEach((node, index) => {
    const angle = plan.nodeOffsetAngle + 0.9 + index * 1.3;
    raw.push({ id: `light-${node.id}`, roadNodeId: node.id, reason: 'approach', position: point(node.position[0] + Math.cos(angle) * plan.lateralOffset, node.position[1] + Math.sin(angle) * plan.lateralOffset) });
  });
  const mainRoads = roads.filter((road) => road.role === 'main-spine');
  for (const road of mainRoads) {
    const total = polylineLength(road.points);
    let travelled = plan.startOffset;
    for (let run = 0; run < 6 && travelled < total - 0.4; run += 1) {
      const sample = sampleAlongPolyline(road.points, travelled);
      if (sample) {
        const side = run % 2 === 0 ? 1 : -1;
        raw.push({ id: `light-run-${road.edgeId}-${run}`, reason: 'intermediate', position: point(sample.position[0] + sample.normal[0] * plan.lateralOffset * side, sample.position[1] + sample.normal[1] * plan.lateralOffset * side) });
      }
      travelled += plan.spacing + rng.range(0, plan.spacingJitter);
    }
    road.points.slice(1, -1).forEach((corner, index) => {
      const angle = plan.nodeOffsetAngle + 2.1 + index * 1.1;
      raw.push({ id: `light-corner-${road.edgeId}-${index}`, reason: 'junction', position: point(corner[0] + Math.cos(angle) * plan.lateralOffset, corner[1] + Math.sin(angle) * plan.lateralOffset) });
    });
  }
  const kept: StreetLightPlacement[] = [];
  for (const light of [...raw].sort((a, b) => a.id.localeCompare(b.id))) {
    if (kept.length >= MAXIMUM_STREET_LIGHTS) break;
    if (kept.some((existing) => distance(existing.position, light.position) < plan.minimumSeparation)) continue;
    kept.push(light);
  }
  if (!kept.some((light) => light.reason === 'intermediate')) {
    const longest = [...mainRoads].sort((a, b) => polylineLength(b.points) - polylineLength(a.points))[0];
    const sample = longest ? sampleAlongPolyline(longest.points, polylineLength(longest.points) / 2) : null;
    if (longest && sample) {
      let nudge = 0;
      let position = point(sample.position[0] + sample.normal[0] * plan.lateralOffset, sample.position[1] + sample.normal[1] * plan.lateralOffset);
      while (nudge < 12 && kept.some((existing) => existing.position[0] === position[0] && existing.position[1] === position[1])) {
        nudge += 1;
        position = point(position[0] + 0.13, position[1] + 0.13);
      }
      kept.push({ id: `light-span-${longest.edgeId}`, reason: 'intermediate', position });
    }
  }
  return kept.sort((a, b) => a.id.localeCompare(b.id));
}

const PLATEAU_SHAPES: Readonly<Record<TerrainVisualVariantId, readonly Point2[]>> = {
  elongated: [[-0.5, -0.38], [0.34, -0.46], [0.52, -0.2], [0.48, 0.34], [0.22, 0.46], [-0.4, 0.4], [-0.54, 0.1]],
  'wide-central-shelf': [[-0.5, -0.28], [-0.18, -0.48], [0.38, -0.4], [0.52, -0.12], [0.46, 0.36], [0.08, 0.47], [-0.46, 0.34], [-0.54, 0]],
  'offset-industrial-shelf': [[-0.46, -0.42], [0.12, -0.46], [0.28, -0.28], [0.52, -0.22], [0.48, 0.22], [0.2, 0.3], [0.08, 0.47], [-0.5, 0.32]],
  'split-ledge': [[-0.52, -0.3], [-0.18, -0.46], [0.08, -0.3], [0.46, -0.42], [0.54, 0.04], [0.34, 0.44], [-0.06, 0.32], [-0.34, 0.46], [-0.54, 0.12]],
};

export const plateauVertexCountFor = (variant: TerrainVisualVariantId): number => PLATEAU_SHAPES[variant].length;

// The silhouette family stays recognisable, but every seed deforms it: global rotation/scale plus
// per-vertex radial and angular jitter, plus up to three extra vertices pushed off an edge. Sorting
// by polar angle at the end keeps the polygon simple no matter how the jitter falls.
function derivePlateauVertices(variant: TerrainVisualVariantId, bounds: ReturnType<typeof deriveCameraBounds>, plan: PlateauPlan): readonly Point2[] {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const base = PLATEAU_SHAPES[variant];
  const jittered: Point2[] = base.map(([x, z], index) => {
    const radius = Math.hypot(x, z) * (plan.radialJitter[index] ?? 1);
    const angle = Math.atan2(z, x) + plan.rotation + (plan.angularJitter[index] ?? 0);
    return [Math.cos(angle) * radius * plan.scaleX, Math.sin(angle) * radius * plan.scaleZ];
  });
  const all: Point2[] = [...jittered];
  for (const extra of plan.extraVertices) {
    const index = extra.edgeIndex % jittered.length;
    const first = jittered[index];
    const second = jittered[(index + 1) % jittered.length];
    if (!first || !second) continue;
    const middle: Point2 = [(first[0] + second[0]) / 2, (first[1] + second[1]) / 2];
    all.push([middle[0] * (1 + extra.offset), middle[1] * (1 + extra.offset)]);
  }
  return all
    .map((vertex) => ({ angle: Math.atan2(vertex[1], vertex[0]), vertex }))
    .sort((a, b) => a.angle - b.angle)
    .map(({ vertex }) => point(bounds.center[0] + vertex[0] * width * 1.12, bounds.center[1] + vertex[1] * depth * 1.12));
}

function derivePropZones(materialized: MaterializedArchetype, bounds: ReturnType<typeof deriveCameraBounds>, candidateIndex: number): readonly PropZone[] {
  const depth = bounds.maxZ - bounds.minZ;
  return materialized.propZonePlans.map((plan, index) => ({
    id: `outer-rocks-${index}`,
    center: point(plan.side < 0 ? bounds.minX + plan.width / 2 + 0.4 : bounds.maxX - plan.width / 2 - 0.4, bounds.center[1] + plan.lateralShift * depth * 0.24),
    width: round(plan.width),
    depth: round(Math.max(1.2, depth * plan.depthScale)),
    density: 'low' as const,
    seedOffset: plan.seedOffset + candidateIndex * 2,
  }));
}

function roadTurningPattern(roads: readonly GeneratedRoad[]): readonly ('corner' | 'straight')[] {
  return roads.filter((road) => road.role === 'main-spine').map((road) => road.points.length > 2 ? 'corner' : 'straight');
}

function signature(archetype: StructuralArchetypeId, habitatVariant: HabitatVisualVariantId, terrainVariant: TerrainVisualVariantId, expansionRelation: StructuralArchetype['expansionRelation'], orientation: StructuralArchetype['mainSpineOrientation'], turns: readonly ('corner' | 'straight')[], variationKey: string): string {
  return [archetype, habitatVariant, terrainVariant, expansionRelation, orientation, turns.join('.'), variationKey].join('|');
}

function pairwiseDistanceVector(layout: GeneratedPlanetLayout): readonly number[] {
  const ordered = [...layout.facilities].sort((a, b) => a.id.localeCompare(b.id));
  const values: number[] = [];
  for (let first = 0; first < ordered.length; first += 1) for (let second = first + 1; second < ordered.length; second += 1) values.push(distance(ordered[first]?.position ?? [0, 0], ordered[second]?.position ?? [0, 0]));
  const maximum = Math.max(1, ...values);
  return values.map((value) => value / maximum);
}

export function calculateStructuralDifference(left: GeneratedPlanetLayout, right: GeneratedPlanetLayout): number {
  let difference = 0;
  if (left.structure.archetype !== right.structure.archetype) difference += 0.36;
  if (left.structure.habitatVariant !== right.structure.habitatVariant) difference += 0.18;
  if (left.structure.terrainVariant !== right.structure.terrainVariant) difference += 0.1;
  if (left.structure.expansionRelation !== right.structure.expansionRelation) difference += 0.12;
  if (left.structure.mainSpineOrientation !== right.structure.mainSpineOrientation) difference += 0.08;
  if (left.structure.roadTurningPattern.join() !== right.structure.roadTurningPattern.join()) difference += 0.1;
  const leftDistances = pairwiseDistanceVector(left);
  const rightDistances = pairwiseDistanceVector(right);
  const matrixDifference = leftDistances.reduce((sum, value, index) => sum + Math.abs(value - (rightDistances[index] ?? value)), 0) / Math.max(1, leftDistances.length);
  difference += Math.min(0.14, matrixDifference * 0.7);
  return Number(Math.min(1, difference).toFixed(3));
}

function archetypeForCandidate(seed: number, candidateIndex: number): StructuralArchetype | undefined {
  return STRUCTURAL_ARCHETYPES[(hashSeed(seed) + candidateIndex) % STRUCTURAL_ARCHETYPES.length];
}

function buildCandidate(seed: number, candidateIndex: number, attempt: number, style: LayoutStyle, terrain: TerrainDefinition): GeneratedPlanetLayout | null {
  const rng = createDeterministicRng(`${seed}:${GENERATOR_VERSION}:${style}:${candidateIndex}:${attempt}`);
  const archetype = archetypeForCandidate(seed, candidateIndex);
  if (!archetype) return null;
  const habitatVariant = archetype.habitatVariants[Math.floor(rng.next() * archetype.habitatVariants.length)] ?? archetype.habitatVariants[0];
  const terrainVariant = archetype.terrainVariants[Math.floor(rng.next() * archetype.terrainVariants.length)] ?? archetype.terrainVariants[0];
  if (!habitatVariant || !terrainVariant) return null;
  const materialized = materializeArchetype(archetype, rng, plateauVertexCountFor(terrainVariant));
  const placed: GeneratedFacilityPlacement[] = [];
  const mainRoads = buildMainRoadGeometry(materialized, terrain);
  for (const id of FACILITY_ORDER) {
    const roadTarget = normalizedToWorld(materialized.anchors[id], terrain);
    const compound = getVisualCompound(id, habitatVariant, rng);
    const choice = chooseFacilityAnchor(id, compound, roadTarget, materialized.facilityPlans[id], mainRoads, placed, terrain, rng);
    if (!choice) return null;
    placed.push(createFacility(id, choice.anchor, choice.rotationY, compound));
  }
  const expansionRoadTarget = normalizedToWorld(materialized.anchors.expansion, terrain);
  const expansion = createExpansion(materialized, terrain, expansionRoadTarget, placed, rng);
  if (!expansion) return null;
  const graph = buildSpatialGraph(placed, expansion, materialized, terrain);
  if (!graph) return null;
  const allPoints = [...placed.flatMap((facility) => [facility.position, facility.entrance, facility.workPoint]), expansion.position, ...graph.roads.flatMap((road) => road.points)];
  const cameraBounds = deriveCameraBounds(allPoints, 3.4);
  const turns = roadTurningPattern(graph.roads);
  const visualModuleCount = placed.reduce((sum, facility) => sum + 1 + facility.visualModules.length, 0) + 1;
  const degrees = mainSpineDegrees(graph.edges);
  const junctionCount = graph.nodes.filter((node) => node.kind === 'spine' && (isJunctionNodeId(node.id) || (degrees.get(node.id) ?? 0) >= 3)).length;
  const structuralSignature = signature(archetype.id, habitatVariant, terrainVariant, archetype.expansionRelation, archetype.mainSpineOrientation, turns, materialized.variationKey);
  const draft: GeneratedPlanetLayout = {
    planetId: 'nivalis-3-prototype', seed, generatorVersion: GENERATOR_VERSION,
    candidateId: `${archetype.id}-${String(candidateIndex + 1).padStart(2, '0')}`, style,
    facilities: placed, expansionSlots: [expansion], roads: graph.roads, navigationNodes: graph.nodes, navigationEdges: graph.edges,
    streetLights: deriveStreetLights(graph.nodes, graph.edges, graph.roads, materialized.streetLightPlan, rng), cameraBounds,
    plateauVertices: derivePlateauVertices(terrainVariant, cameraBounds, materialized.plateauPlan),
    zones: terrain.areas.map((area) => ({ ...area })),
    propZones: derivePropZones(materialized, cameraBounds, candidateIndex),
    score: 0, scoreBreakdown: EMPTY_SCORE,
    structure: {
      archetype: archetype.id, habitatVariant, terrainVariant, expansionRelation: archetype.expansionRelation,
      mainSpineOrientation: archetype.mainSpineOrientation, junctionCount,
      roadTurningPattern: turns, visualModuleCount, differenceScore: 0, signature: structuralSignature,
      clusterAssignments: { habitat: 'core', oxygen: 'life-support', battery: 'energy', reactor: 'energy', solar: 'energy', mine: 'industrial' },
    },
  };
  const scoreBreakdown = scoreGeneratedLayout(draft);
  return { ...draft, scoreBreakdown, score: totalLayoutScore(scoreBreakdown) };
}

// One representative per archetype, but not the strict maximum: picking the single best-scoring
// materialization would regress every seed towards the same "optimal" arrangement and undo the
// per-seed variation. A seed-rotated pick inside a score tolerance keeps quality while preserving it.
const REPRESENTATIVE_SCORE_TOLERANCE = 2.5;

function representativeFor(pool: readonly GeneratedPlanetLayout[], seed: number, archetype: StructuralArchetypeId, usedTerrain: ReadonlySet<TerrainVisualVariantId>, usedHabitat: ReadonlySet<HabitatVisualVariantId>): GeneratedPlanetLayout | undefined {
  const ranked = [...pool].sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId));
  const best = ranked[0];
  if (!best) return undefined;
  const acceptable = ranked.filter((candidate) => candidate.score >= best.score - REPRESENTATIVE_SCORE_TOLERANCE);
  // Within the tolerance band, prefer materializations that also add an unseen silhouette/habitat
  // family, then let the seed decide - variance across seeds without collapsing visual variety.
  const noveltyOf = (candidate: GeneratedPlanetLayout) => (usedTerrain.has(candidate.structure.terrainVariant) ? 0 : 2) + (usedHabitat.has(candidate.structure.habitatVariant) ? 0 : 1);
  const bestNovelty = Math.max(...acceptable.map(noveltyOf));
  const shortlist = acceptable.filter((candidate) => noveltyOf(candidate) === bestNovelty);
  return shortlist[hashSeed(`${seed}:${archetype}`) % shortlist.length] ?? best;
}

function selectDiverseCandidates(valid: readonly GeneratedPlanetLayout[], count: number, seed: number): readonly GeneratedPlanetLayout[] {
  const byArchetype = new Map<StructuralArchetypeId, GeneratedPlanetLayout[]>();
  for (const candidate of valid) {
    const bucket = byArchetype.get(candidate.structure.archetype);
    if (bucket) bucket.push(candidate); else byArchetype.set(candidate.structure.archetype, [candidate]);
  }
  const usedTerrain = new Set<TerrainVisualVariantId>();
  const usedHabitat = new Set<HabitatVisualVariantId>();
  const representatives = [...byArchetype.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([archetype, pool]) => {
      const representative = representativeFor(pool, seed, archetype, usedTerrain, usedHabitat);
      if (!representative) return [];
      usedTerrain.add(representative.structure.terrainVariant);
      usedHabitat.add(representative.structure.habitatVariant);
      return [representative];
    })
    .sort((a, b) => a.structure.archetype.localeCompare(b.structure.archetype) || b.score - a.score);
  const selected: GeneratedPlanetLayout[] = [];
  for (const candidate of representatives) {
    if (selected.length >= count) break;
    if (selected.every((existing) => calculateStructuralDifference(existing, candidate) >= DIVERSITY_THRESHOLD)) selected.push(candidate);
  }
  for (const candidate of valid) {
    if (selected.length >= count) break;
    if (selected.some((existing) => existing.candidateId === candidate.candidateId)) continue;
    if (selected.every((existing) => calculateStructuralDifference(existing, candidate) >= DIVERSITY_THRESHOLD)) selected.push(candidate);
  }
  const scoreSorted = [...selected].sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId));
  const withDifferenceScore = scoreSorted.map((candidate, index) => ({ ...candidate, structure: { ...candidate.structure, differenceScore: index === 0 ? 1 : Math.min(...scoreSorted.slice(0, index).map((other) => calculateStructuralDifference(other, candidate))) } }));
  if (withDifferenceScore.length === 0) return withDifferenceScore;
  const rotation = hashSeed(seed) % withDifferenceScore.length;
  return [...withDifferenceScore.slice(rotation), ...withDifferenceScore.slice(0, rotation)];
}

export function generateLayoutCandidates(options: GenerateLayoutOptions): LayoutGenerationResult {
  const seed = typeof options.seed === 'number' ? options.seed >>> 0 : hashSeed(options.seed);
  const style = options.style ?? NIVALIS_LAYOUT_INTENT.style;
  const terrain = options.terrain ?? NIVALIS_TERRAIN;
  const internalCandidateCount = Math.max(1, Math.min(80, Math.floor(options.internalCandidateCount ?? INTERNAL_CANDIDATE_COUNT)));
  const visualCandidateCount = Math.max(1, Math.min(10, Math.floor(options.visualCandidateCount ?? VISUAL_CANDIDATE_COUNT)));
  const valid: GeneratedPlanetLayout[] = [];
  const reasons = new Set<string>();
  // A wide variation space means individual materializations can fail placement or validation. A
  // struggling archetype gets deterministic re-rolls so widening the search space never costs it its
  // representative in the shortlist; archetypes that already have candidates stay at a single roll.
  const validPerArchetype = new Map<StructuralArchetypeId, number>();
  for (let index = 0; index < internalCandidateCount; index += 1) {
    const archetypeId = archetypeForCandidate(seed, index)?.id;
    const attempts = archetypeId && (validPerArchetype.get(archetypeId) ?? 0) >= RETRY_RELIEF_THRESHOLD ? 1 : MATERIALIZATION_ATTEMPTS;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidate = buildCandidate(seed, index, attempt, style, terrain);
      if (!candidate) { reasons.add(`structural-generation-failed:${archetypeId ?? 'unknown'}`); continue; }
      const validation = validateGeneratedLayout(candidate, terrain);
      if (validation.valid) {
        valid.push(candidate);
        if (archetypeId) validPerArchetype.set(archetypeId, (validPerArchetype.get(archetypeId) ?? 0) + 1);
        break;
      }
      validation.reasons.forEach((reason) => reasons.add(reason));
    }
  }
  valid.sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId));
  const candidates = selectDiverseCandidates(valid, visualCandidateCount, seed);
  if (candidates.length < visualCandidateCount) return { status: 'failure', seed, attemptedCandidates: internalCandidateCount, reasons: [...reasons, `insufficient-diversity:${candidates.length}/${visualCandidateCount}`].sort() };
  return { status: 'success', seed, attemptedCandidates: internalCandidateCount, candidates };
}

export interface SeedSweepReport {
  readonly averageCandidateCount: number;
  readonly averageGenerationMs: number;
  readonly averageStructuralSignatures: number;
  readonly failed: number;
  readonly failures: readonly { readonly reasons: readonly string[]; readonly seed: number }[];
  readonly highestScore: number;
  readonly lowestScore: number;
  readonly minimumStructuralSignatures: number;
  readonly testedSeeds: number;
  readonly valid: number;
}

export function runLayoutSeedSweep(count = 100, startingSeed = 1): SeedSweepReport {
  const start = globalThis.performance.now();
  const failures: { reasons: readonly string[]; seed: number }[] = [];
  const scores: number[] = [];
  const signatureCounts: number[] = [];
  let candidateCount = 0;
  for (let offset = 0; offset < count; offset += 1) {
    const seed = startingSeed + offset;
    const result = generateLayoutCandidates({ seed, visualCandidateCount: 3 });
    if (result.status === 'failure') failures.push({ seed, reasons: result.reasons });
    else {
      const signatures = new Set(result.candidates.map((candidate) => candidate.structure.signature)).size;
      const archetypes = new Set(result.candidates.map((candidate) => candidate.structure.archetype)).size;
      if (signatures < 3 || archetypes < 3) failures.push({ seed, reasons: [`insufficient-structural-diversity:${signatures}:${archetypes}`] });
      else { candidateCount += result.candidates.length; signatureCounts.push(signatures); scores.push(result.candidates[0]?.score ?? 0); }
    }
  }
  const elapsed = globalThis.performance.now() - start;
  const valid = count - failures.length;
  return {
    testedSeeds: count, valid, failed: failures.length, failures,
    averageCandidateCount: Number((candidateCount / Math.max(1, valid)).toFixed(2)),
    averageGenerationMs: Number((elapsed / Math.max(1, count)).toFixed(2)),
    averageStructuralSignatures: Number((signatureCounts.reduce((sum, value) => sum + value, 0) / Math.max(1, signatureCounts.length)).toFixed(2)),
    minimumStructuralSignatures: signatureCounts.length ? Math.min(...signatureCounts) : 0,
    highestScore: scores.length ? Math.max(...scores) : 0,
    lowestScore: scores.length ? Math.min(...scores) : 0,
  };
}
