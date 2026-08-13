import { requirePrototypeAsset } from '../assets/prototypeAssetRegistry';
import type { FacilityId } from '../prototype/types';
import { createDeterministicRng, hashSeed, type DeterministicRng } from './deterministicRng';
import { deriveCameraBounds, distance, pointInRect, rectContains, rectanglesOverlap, segmentIntersectsRect, transformLocalPoint } from './layoutMath';
import { scoreGeneratedLayout, totalLayoutScore } from './layoutScoring';
import { validateGeneratedLayout } from './layoutValidation';
import {
  GENERATOR_VERSION,
  INTERNAL_CANDIDATE_COUNT,
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
  LayoutGenerationResult,
  LayoutScoreBreakdown,
  LayoutStyle,
  NavigationEdge,
  NavigationNode,
  Point2,
  Rect2,
  StreetLightPlacement,
  StructuralArchetypeId,
  TerrainDefinition,
  TerrainVisualVariantId,
} from './layoutTypes';

const EMPTY_SCORE: LayoutScoreBreakdown = Object.freeze({ adjacency: 0, cameraReadability: 0, compactness: 0, expansionAccess: 0, roadQuality: 0, safetySeparation: 0, screenSpaceOverlap: 0, terrainUsage: 0, visualComposition: 0 });
const FACILITY_ORDER: readonly FacilityId[] = ['habitat', 'oxygen', 'battery', 'reactor', 'solar', 'mine'];
const ROUTE_ORDER = ['solar', 'reactor', 'battery', 'habitat', 'oxygen', 'mine', 'expansion'] as const;
const DIVERSITY_THRESHOLD = 0.32;
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
  return point(terrain.bounds.center[0] + normalized[0] * terrain.bounds.width * 0.47, terrain.bounds.center[1] + normalized[1] * terrain.bounds.depth * 0.47);
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

export function generateZoneAnchors(area: Rect2, footprint: { readonly depth: number; readonly width: number }, rng: DeterministicRng): readonly Point2[] {
  const columns = 5;
  const rows = 4;
  const usableWidth = Math.max(0, area.width - footprint.width - 1.2);
  const usableDepth = Math.max(0, area.depth - footprint.depth - 1.2);
  const anchors: Point2[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const x = area.center[0] - usableWidth / 2 + usableWidth * column / Math.max(1, columns - 1);
    const z = area.center[1] - usableDepth / 2 + usableDepth * row / Math.max(1, rows - 1);
    anchors.push(point(x + rng.range(-0.38, 0.38), z + rng.range(-0.38, 0.38)));
  }
  return anchors;
}

function chooseFacilityAnchor(id: FacilityId, compound: VisualCompoundProfile, roadTarget: Point2, mainRoads: readonly GeneratedRoad[], placed: readonly GeneratedFacilityPlacement[], terrain: TerrainDefinition, rng: DeterministicRng): Point2 | null {
  const area = zoneForFacility(id, terrain);
  if (!area) return null;
  const side = id === 'reactor' || id === 'habitat' || id === 'mine' ? -1 : 1;
  const expected: Point2 = [roadTarget[0], roadTarget[1] + side * (compound.depth / 2 + 2.1)];
  const buildable = terrain.areas.find((candidate) => candidate.id === 'buildable-plateau') ?? terrain.bounds;
  const forbidden = terrain.areas.filter((candidate) => candidate.tags.includes('blocked') || candidate.tags.includes('hazardZone'));
  const structuralRadius = Math.max(compound.width, compound.depth) / 2 + 2.6;
  const structuralAnchors = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return point(roadTarget[0] + Math.cos(angle) * structuralRadius + rng.range(-0.3, 0.3), roadTarget[1] + Math.sin(angle) * structuralRadius + rng.range(-0.3, 0.3));
  });
  const candidates = [...structuralAnchors, ...generateZoneAnchors(area, { width: compound.width, depth: compound.depth }, rng)]
    .map((anchor) => ({ anchor, score: distance(anchor, expected) + rng.range(0, 0.35) }))
    .sort((a, b) => a.score - b.score || a.anchor[0] - b.anchor[0] || a.anchor[1] - b.anchor[1]);
  return candidates.find(({ anchor }) => {
    const rotationY = Math.atan2(roadTarget[0] - anchor[0], roadTarget[1] - anchor[1]);
    const footprint: Rect2 = { center: anchor, ...rotatedAabb(compound.width, compound.depth, rotationY) };
    return pointInRect(anchor, area)
      && rectContains(buildable, footprint)
      && forbidden.every((blocked) => !rectanglesOverlap(footprint, blocked))
      && mainRoads.every((road) => road.points.slice(1).every((end, index) => !segmentIntersectsRect(road.points[index] ?? end, end, footprint, 0.2)))
      && placed.every((facility) => !rectanglesOverlap(footprint, facility.visualFootprint, 0.7));
  })?.anchor ?? null;
}

function createFacility(id: FacilityId, position: Point2, roadTarget: Point2, compound: VisualCompoundProfile): GeneratedFacilityPlacement {
  const primaryAssetId = NIVALIS_FACILITY_ASSETS[id];
  const asset = requirePrototypeAsset(primaryAssetId);
  if (!asset.targetFootprint || !asset.entrancePoint || !asset.workPoint) throw new Error(`AssetRegistry geometry is incomplete for ${primaryAssetId}.`);
  const rotationY = Math.atan2(roadTarget[0] - position[0], roadTarget[1] - position[1]);
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

function createExpansion(archetype: StructuralArchetype, terrain: TerrainDefinition, roadTarget: Point2, facilities: readonly GeneratedFacilityPlacement[], rng: DeterministicRng): GeneratedExpansionSlot | null {
  const area = expansionAreaFor(archetype.expansionRelation, terrain);
  if (!area) return null;
  const anchors = [...generateZoneAnchors(area, { width: 5, depth: 5 }, rng)].sort((a, b) => distance(a, roadTarget) - distance(b, roadTarget));
  const position = anchors.find((anchor) => facilities.every((facility) => !rectanglesOverlap(facility.visualFootprint, { center: anchor, width: 5, depth: 5 }, 2.5)));
  if (!position) return null;
  const rotationY = Math.atan2(roadTarget[0] - position[0], roadTarget[1] - position[1]);
  return { id: 'expansion', primaryAssetId: 'expansion-pad', position, rotationY, footprintCapacity: { width: 5, depth: 5 }, compatibility: ['standard-buffer-module'], accessNodeId: 'expansion-entrance' };
}

function routeKey(from: typeof ROUTE_ORDER[number], to: typeof ROUTE_ORDER[number]): `${typeof ROUTE_ORDER[number]}>${typeof ROUTE_ORDER[number]}` {
  return `${from}>${to}`;
}

function buildMainRoadGeometry(archetype: StructuralArchetype, terrain: TerrainDefinition): readonly GeneratedRoad[] {
  return archetype.mainConnections.map(([id, toId], index) => {
    const start = normalizedToWorld(archetype.attachmentTargets[id], terrain);
    const goal = normalizedToWorld(archetype.attachmentTargets[toId], terrain);
    const corners = archetype.routeCorners[routeKey(id, toId)] ?? [];
    return { edgeId: `main-spine-${index}`, role: 'main-spine' as const, points: simplifyPath([start, ...corners.map((corner) => normalizedToWorld(corner, terrain)), goal]) };
  });
}

function buildSpatialGraph(facilities: readonly GeneratedFacilityPlacement[], expansion: GeneratedExpansionSlot, archetype: StructuralArchetype, terrain: TerrainDefinition): { readonly edges: readonly NavigationEdge[]; readonly nodes: readonly NavigationNode[]; readonly roads: readonly GeneratedRoad[] } | null {
  const spineTargets = Object.fromEntries(ROUTE_ORDER.map((id) => [id, normalizedToWorld(archetype.attachmentTargets[id], terrain)])) as Record<typeof ROUTE_ORDER[number], Point2>;
  const entranceById = Object.fromEntries([...facilities.map((facility) => [facility.id, facility.entrance] as const), ['expansion', transformLocalPoint([0, 2.8], expansion.position, expansion.rotationY)]]) as Record<typeof ROUTE_ORDER[number], Point2>;
  const spineNodes: NavigationNode[] = ROUTE_ORDER.map((id) => ({ id: `spine-${id}`, entityId: id, kind: 'spine', position: spineTargets[id] }));
  const accessNodes: NavigationNode[] = ROUTE_ORDER.flatMap((id) => {
    const entrance = entranceById[id];
    const spine = spineTargets[id];
    const length = Math.max(0.001, distance(entrance, spine));
    const approach = point(entrance[0] + (spine[0] - entrance[0]) / length * 0.85, entrance[1] + (spine[1] - entrance[1]) / length * 0.85);
    return [{ id: `${id}-approach`, entityId: id, kind: 'approach' as const, position: approach }, { id: `${id}-entrance`, entityId: id, kind: 'entrance' as const, position: entrance }];
  });
  const nodes = [...spineNodes, ...accessNodes];
  const edges: NavigationEdge[] = [
    ...archetype.mainConnections.map(([from, to], index) => ({ id: `main-spine-${index}`, from: `spine-${from}`, to: `spine-${to}`, role: 'main-spine' as const })),
    ...ROUTE_ORDER.flatMap((id) => [{ id: `${id}-service`, from: `spine-${id}`, to: `${id}-approach`, role: 'service' as const }, { id: `${id}-entrance-link`, from: `${id}-approach`, to: `${id}-entrance`, role: 'entrance-link' as const }]),
  ];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const mainRoads = buildMainRoadGeometry(archetype, terrain);
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
      const compoundObstacles = facilities.filter((facility) => facility.id !== targetId).map((facility) => ({ id: `compound-obstacle-${facility.id}`, center: facility.visualFootprint.center, width: facility.visualFootprint.width + 0.4, depth: facility.visualFootprint.depth + 0.4, tags: ['blocked' as const] }));
      rawPath = findTerrainPath({ start, goal, terrain: { ...terrain, areas: [...terrain.areas, ...compoundObstacles] } });
    }
    if (!rawPath) return null;
    roads.push({ edgeId: edge.id, role: edge.role, points: simplifyPath(rawPath) });
  }
  return { nodes, edges, roads };
}

function deriveStreetLights(nodes: readonly NavigationNode[], edges: readonly NavigationEdge[], roads: readonly GeneratedRoad[]): readonly StreetLightPlacement[] {
  const lights: StreetLightPlacement[] = [];
  const spineNodes = nodes.filter((node) => node.kind === 'spine');
  spineNodes.forEach((node, index) => {
    const degree = edges.filter((edge) => edge.from === node.id || edge.to === node.id).length;
    if (degree >= 3 || index % 2 === 0) lights.push({ id: `light-${node.id}`, roadNodeId: node.id, reason: degree >= 3 ? 'junction' : 'intermediate', position: point(node.position[0] + 0.65, node.position[1] + 0.65) });
  });
  nodes.filter((node) => node.kind === 'approach' && ['habitat', 'mine', 'reactor'].includes(node.entityId ?? '')).forEach((node) => lights.push({ id: `light-${node.id}`, roadNodeId: node.id, reason: 'approach', position: point(node.position[0] + 0.6, node.position[1]) }));
  roads.filter((road) => road.role === 'main-spine').forEach((road) => road.points.slice(1, -1).forEach((corner, index) => lights.push({ id: `light-corner-${road.edgeId}-${index}`, reason: 'junction', position: point(corner[0] + 0.55, corner[1] + 0.55) })));
  const unique = new Map(lights.map((light) => [`${light.position[0].toFixed(2)}:${light.position[1].toFixed(2)}`, light]));
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function derivePlateauVertices(variant: TerrainVisualVariantId, bounds: ReturnType<typeof deriveCameraBounds>): readonly Point2[] {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const cx = bounds.center[0]; const cz = bounds.center[1];
  const shapes: Record<TerrainVisualVariantId, readonly Point2[]> = {
    elongated: [[-0.5, -0.38], [0.34, -0.46], [0.52, -0.2], [0.48, 0.34], [0.22, 0.46], [-0.4, 0.4], [-0.54, 0.1]],
    'wide-central-shelf': [[-0.5, -0.28], [-0.18, -0.48], [0.38, -0.4], [0.52, -0.12], [0.46, 0.36], [0.08, 0.47], [-0.46, 0.34], [-0.54, 0]],
    'offset-industrial-shelf': [[-0.46, -0.42], [0.12, -0.46], [0.28, -0.28], [0.52, -0.22], [0.48, 0.22], [0.2, 0.3], [0.08, 0.47], [-0.5, 0.32]],
    'split-ledge': [[-0.52, -0.3], [-0.18, -0.46], [0.08, -0.3], [0.46, -0.42], [0.54, 0.04], [0.34, 0.44], [-0.06, 0.32], [-0.34, 0.46], [-0.54, 0.12]],
  };
  return shapes[variant].map(([x, z]) => point(cx + x * width * 1.12, cz + z * depth * 1.12));
}

function roadTurningPattern(roads: readonly GeneratedRoad[]): readonly ('corner' | 'straight')[] {
  return roads.filter((road) => road.role === 'main-spine').map((road) => road.points.length > 2 ? 'corner' : 'straight');
}

function signature(archetype: StructuralArchetypeId, habitatVariant: HabitatVisualVariantId, terrainVariant: TerrainVisualVariantId, expansionRelation: StructuralArchetype['expansionRelation'], orientation: StructuralArchetype['mainSpineOrientation'], turns: readonly ('corner' | 'straight')[]): string {
  return [archetype, habitatVariant, terrainVariant, expansionRelation, orientation, turns.join('.')].join('|');
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

function buildCandidate(seed: number, candidateIndex: number, style: LayoutStyle, terrain: TerrainDefinition): GeneratedPlanetLayout | null {
  const rng = createDeterministicRng(`${seed}:${GENERATOR_VERSION}:${style}:${candidateIndex}`);
  const archetype = archetypeForCandidate(seed, candidateIndex);
  if (!archetype) return null;
  const habitatVariant = archetype.habitatVariants[Math.floor(rng.next() * archetype.habitatVariants.length)] ?? archetype.habitatVariants[0];
  const terrainVariant = archetype.terrainVariants[Math.floor(rng.next() * archetype.terrainVariants.length)] ?? archetype.terrainVariants[0];
  if (!habitatVariant || !terrainVariant) return null;
  const placed: GeneratedFacilityPlacement[] = [];
  const mainRoads = buildMainRoadGeometry(archetype, terrain);
  for (const id of FACILITY_ORDER) {
    const roadTarget = normalizedToWorld(archetype.attachmentTargets[id], terrain);
    const compound = getVisualCompound(id, habitatVariant, rng);
    const anchor = chooseFacilityAnchor(id, compound, roadTarget, mainRoads, placed, terrain, rng);
    if (!anchor) return null;
    placed.push(createFacility(id, anchor, roadTarget, compound));
  }
  const expansionRoadTarget = normalizedToWorld(archetype.attachmentTargets.expansion, terrain);
  const expansion = createExpansion(archetype, terrain, expansionRoadTarget, placed, rng);
  if (!expansion) return null;
  const graph = buildSpatialGraph(placed, expansion, archetype, terrain);
  if (!graph) return null;
  const allPoints = [...placed.flatMap((facility) => [facility.position, facility.entrance, facility.workPoint]), expansion.position, ...graph.roads.flatMap((road) => road.points)];
  const cameraBounds = deriveCameraBounds(allPoints, 3.4);
  const turns = roadTurningPattern(graph.roads);
  const visualModuleCount = placed.reduce((sum, facility) => sum + 1 + facility.visualModules.length, 0) + 1;
  const structuralSignature = signature(archetype.id, habitatVariant, terrainVariant, archetype.expansionRelation, archetype.mainSpineOrientation, turns);
  const draft: GeneratedPlanetLayout = {
    planetId: 'nivalis-3-prototype', seed, generatorVersion: GENERATOR_VERSION,
    candidateId: `${archetype.id}-${String(candidateIndex + 1).padStart(2, '0')}`, style,
    facilities: placed, expansionSlots: [expansion], roads: graph.roads, navigationNodes: graph.nodes, navigationEdges: graph.edges,
    streetLights: deriveStreetLights(graph.nodes, graph.edges, graph.roads), cameraBounds,
    plateauVertices: derivePlateauVertices(terrainVariant, cameraBounds),
    zones: terrain.areas.map((area) => ({ ...area })),
    propZones: [
      { id: 'outer-rocks-west', center: [cameraBounds.minX + 1.5, cameraBounds.center[1]], width: 2, depth: (cameraBounds.maxZ - cameraBounds.minZ) * 0.65, density: 'low', seedOffset: candidateIndex * 2 },
      { id: 'outer-rocks-east', center: [cameraBounds.maxX - 1.5, cameraBounds.center[1]], width: 2, depth: (cameraBounds.maxZ - cameraBounds.minZ) * 0.65, density: 'low', seedOffset: candidateIndex * 2 + 1 },
    ],
    score: 0, scoreBreakdown: EMPTY_SCORE,
    structure: {
      archetype: archetype.id, habitatVariant, terrainVariant, expansionRelation: archetype.expansionRelation,
      mainSpineOrientation: archetype.mainSpineOrientation, junctionCount: archetype.junctionCount,
      roadTurningPattern: turns, visualModuleCount, differenceScore: 0, signature: structuralSignature,
      clusterAssignments: { habitat: 'core', oxygen: 'life-support', battery: 'energy', reactor: 'energy', solar: 'energy', mine: 'industrial' },
    },
  };
  const scoreBreakdown = scoreGeneratedLayout(draft);
  return { ...draft, scoreBreakdown, score: totalLayoutScore(scoreBreakdown) };
}

function selectDiverseCandidates(valid: readonly GeneratedPlanetLayout[], count: number, seed: number): readonly GeneratedPlanetLayout[] {
  const bestByArchetype = new Map<StructuralArchetypeId, GeneratedPlanetLayout>();
  for (const candidate of valid) {
    const current = bestByArchetype.get(candidate.structure.archetype);
    if (!current || candidate.score > current.score || candidate.score === current.score && candidate.candidateId.localeCompare(current.candidateId) < 0) bestByArchetype.set(candidate.structure.archetype, candidate);
  }
  const representatives = [...bestByArchetype.values()].sort((a, b) => a.structure.archetype.localeCompare(b.structure.archetype) || b.score - a.score);
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
  const rotation = hashSeed(seed) % withDifferenceScore.length;
  const rotated = [...withDifferenceScore.slice(rotation), ...withDifferenceScore.slice(0, rotation)];
  return rotated;
}

export function generateLayoutCandidates(options: GenerateLayoutOptions): LayoutGenerationResult {
  const seed = typeof options.seed === 'number' ? options.seed >>> 0 : hashSeed(options.seed);
  const style = options.style ?? NIVALIS_LAYOUT_INTENT.style;
  const terrain = options.terrain ?? NIVALIS_TERRAIN;
  const internalCandidateCount = Math.max(1, Math.min(50, Math.floor(options.internalCandidateCount ?? INTERNAL_CANDIDATE_COUNT)));
  const visualCandidateCount = Math.max(1, Math.min(10, Math.floor(options.visualCandidateCount ?? VISUAL_CANDIDATE_COUNT)));
  const valid: GeneratedPlanetLayout[] = [];
  const reasons = new Set<string>();
  for (let index = 0; index < internalCandidateCount; index += 1) {
    const candidate = buildCandidate(seed, index, style, terrain);
    if (!candidate) { reasons.add(`structural-generation-failed:${archetypeForCandidate(seed, index)?.id ?? 'unknown'}`); continue; }
    const validation = validateGeneratedLayout(candidate, terrain);
    if (validation.valid) valid.push(candidate); else validation.reasons.forEach((reason) => reasons.add(reason));
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
