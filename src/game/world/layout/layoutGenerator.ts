import { requirePrototypeAsset } from '../assets/prototypeAssetRegistry';
import type { FacilityId } from '../prototype/types';
import { createDeterministicRng, hashSeed } from './deterministicRng';
import { deriveCameraBounds, transformLocalPoint } from './layoutMath';
import { scoreGeneratedLayout, totalLayoutScore } from './layoutScoring';
import { validateGeneratedLayout } from './layoutValidation';
import {
  GENERATOR_VERSION,
  INTERNAL_CANDIDATE_COUNT,
  NIVALIS_FACILITY_ASSETS,
  NIVALIS_LAYOUT_INTENT,
  NIVALIS_PLACEMENT_PROFILES,
  NIVALIS_TERRAIN,
  STYLE_BASE_POSITIONS,
  VISUAL_CANDIDATE_COUNT,
} from './nivalisLayoutIntent';
import { findTerrainPath, simplifyPath } from './terrainPathfinding';
import type {
  GeneratedExpansionSlot,
  GeneratedFacilityPlacement,
  GeneratedPlanetLayout,
  GeneratedRoad,
  LayoutGenerationResult,
  LayoutScoreBreakdown,
  LayoutStyle,
  NavigationEdge,
  NavigationNode,
  Point2,
  StreetLightPlacement,
  TerrainDefinition,
} from './layoutTypes';

const EMPTY_SCORE: LayoutScoreBreakdown = Object.freeze({ adjacency: 0, cameraReadability: 0, compactness: 0, expansionAccess: 0, roadQuality: 0, safetySeparation: 0, screenSpaceOverlap: 0, terrainUsage: 0, visualComposition: 0 });
const round = (value: number) => Number(value.toFixed(3));
const point = (x: number, z: number): Point2 => [round(x), round(z)];

export interface GenerateLayoutOptions {
  readonly internalCandidateCount?: number;
  readonly seed: number | string;
  readonly style?: LayoutStyle;
  readonly terrain?: TerrainDefinition;
  readonly visualCandidateCount?: number;
}

function createFacility(id: FacilityId, position: Point2): GeneratedFacilityPlacement {
  const primaryAssetId = NIVALIS_FACILITY_ASSETS[id];
  const asset = requirePrototypeAsset(primaryAssetId);
  if (!asset.targetFootprint || !asset.entrancePoint || !asset.workPoint) throw new Error(`AssetRegistry geometry is incomplete for ${primaryAssetId}.`);
  const rotationY = position[1] >= 0 ? Math.PI : 0;
  const entrance = transformLocalPoint([asset.entrancePoint.x, asset.entrancePoint.z], position, rotationY);
  const workPoint = transformLocalPoint([asset.workPoint.x, asset.workPoint.z], position, rotationY);
  return {
    id,
    primaryAssetId,
    position,
    rotationY,
    entrance: point(entrance[0], entrance[1]),
    workPoint: point(workPoint[0], workPoint[1]),
    footprint: { center: position, width: asset.targetFootprint.width, depth: asset.targetFootprint.depth },
    serviceClearance: NIVALIS_PLACEMENT_PROFILES[id].serviceClearance,
  };
}

function createCandidatePositions(seed: number, candidateIndex: number, style: LayoutStyle): Readonly<Record<FacilityId | 'expansion', Point2>> {
  const rng = createDeterministicRng(`${seed}:${GENERATOR_VERSION}:${style}:${candidateIndex}`);
  const base = STYLE_BASE_POSITIONS[style];
  const globalX = rng.range(-0.45, 0.45);
  const rowSpread = rng.range(-0.28, 0.32);
  const xJitter = style === 'Distributed' ? 0.7 : 0.48;
  return Object.fromEntries(Object.entries(base).map(([id, [x, z]]) => [id, point(x + globalX + rng.range(-xJitter, xJitter), z + Math.sign(z) * rowSpread + rng.range(-0.18, 0.18))])) as unknown as Readonly<Record<FacilityId | 'expansion', Point2>>;
}

function buildSpatialGraph(facilities: readonly GeneratedFacilityPlacement[], expansion: GeneratedExpansionSlot, terrain: TerrainDefinition): { readonly edges: readonly NavigationEdge[]; readonly nodes: readonly NavigationNode[]; readonly roads: readonly GeneratedRoad[] } | null {
  const entities = [...facilities.map((facility) => ({ id: facility.id, entrance: facility.entrance })), { id: 'expansion' as const, entrance: point(expansion.position[0], expansion.position[1] - 2.8) }].sort((a, b) => a.entrance[0] - b.entrance[0] || a.id.localeCompare(b.id));
  const spineNodes: NavigationNode[] = entities.map((entity) => ({ id: `spine-${entity.id}`, entityId: entity.id, kind: 'spine', position: point(entity.entrance[0], 0) }));
  const accessNodes: NavigationNode[] = entities.flatMap((entity) => {
    const approachZ = entity.entrance[1] >= 0 ? 0.75 : -0.75;
    return [
      { id: `${entity.id}-approach`, entityId: entity.id, kind: 'approach' as const, position: point(entity.entrance[0], approachZ) },
      { id: `${entity.id}-entrance`, entityId: entity.id, kind: 'entrance' as const, position: entity.entrance },
    ];
  });
  const nodes = [...spineNodes, ...accessNodes];
  const edges: NavigationEdge[] = [
    ...spineNodes.slice(0, -1).map((node, index) => ({ id: `main-spine-${index}`, from: node.id, to: spineNodes[index + 1]?.id ?? node.id, role: 'main-spine' as const })),
    ...entities.flatMap((entity) => [
      { id: `${entity.id}-service`, from: `spine-${entity.id}`, to: `${entity.id}-approach`, role: 'service' as const },
      { id: `${entity.id}-entrance-link`, from: `${entity.id}-approach`, to: `${entity.id}-entrance`, role: 'entrance-link' as const },
    ]),
  ];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const roads: GeneratedRoad[] = [];
  for (const edge of edges) {
    const start = nodeById.get(edge.from)?.position;
    const goal = nodeById.get(edge.to)?.position;
    if (!start || !goal) return null;
    const targetId = nodeById.get(edge.to)?.entityId;
    const blockedFootprints = facilities.filter((facility) => facility.id !== targetId).map((facility) => facility.footprint);
    const rawPath = edge.role === 'service' ? findTerrainPath({ start, goal, terrain, blockedFootprints }) : [start, goal];
    if (!rawPath) return null;
    roads.push({ edgeId: edge.id, role: edge.role, points: simplifyPath(rawPath) });
  }
  return { nodes, edges, roads };
}

function deriveStreetLights(nodes: readonly NavigationNode[], edges: readonly NavigationEdge[]): readonly StreetLightPlacement[] {
  const degree = new Map<string, number>();
  edges.forEach((edge) => { degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1); degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1); });
  const lights: StreetLightPlacement[] = [];
  for (const node of nodes) {
    const isPriorityApproach = node.kind === 'approach' && ['habitat', 'mine', 'reactor'].includes(node.entityId ?? '');
    if ((node.kind === 'spine' && (degree.get(node.id) ?? 0) >= 3) || isPriorityApproach) {
      lights.push({ id: `light-${node.id}`, roadNodeId: node.id, reason: node.kind === 'spine' ? 'junction' : 'approach', position: point(node.position[0] + (node.kind === 'spine' ? 0 : 0.8), node.position[1] + (node.kind === 'spine' ? 0.85 : 0)) });
    }
  }
  const spine = nodes.filter((node) => node.kind === 'spine').sort((a, b) => a.position[0] - b.position[0]);
  for (let index = 0; index < spine.length - 1; index += 1) {
    const start = spine[index]; const end = spine[index + 1];
    if (start && end && Math.abs(end.position[0] - start.position[0]) > 4.2) lights.push({ id: `light-mid-${index}`, reason: 'intermediate', position: point((start.position[0] + end.position[0]) / 2, 0.85) });
  }
  const unique = new Map(lights.map((light) => [`${light.position[0].toFixed(2)}:${light.position[1].toFixed(2)}`, light]));
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function buildCandidate(seed: number, candidateIndex: number, style: LayoutStyle, terrain: TerrainDefinition): GeneratedPlanetLayout | null {
  const positions = createCandidatePositions(seed, candidateIndex, style);
  const facilities = NIVALIS_LAYOUT_INTENT.requiredFacilities.map((id) => createFacility(id, positions[id]));
  const expansionPosition = positions.expansion;
  const expansion: GeneratedExpansionSlot = { id: 'expansion', primaryAssetId: 'expansion-pad', position: expansionPosition, rotationY: Math.PI, footprintCapacity: { width: 5, depth: 5 }, compatibility: ['standard-buffer-module'], accessNodeId: 'expansion-entrance' };
  const graph = buildSpatialGraph(facilities, expansion, terrain);
  if (!graph) return null;
  const allPoints = [...facilities.map((facility) => facility.position), expansion.position, ...graph.roads.flatMap((road) => road.points)];
  const candidateId = `${style.toLowerCase()}-${String(candidateIndex + 1).padStart(2, '0')}`;
  const draft: GeneratedPlanetLayout = {
    planetId: 'nivalis-3-prototype', seed, generatorVersion: GENERATOR_VERSION, candidateId, style,
    facilities, expansionSlots: [expansion], roads: graph.roads, navigationNodes: graph.nodes, navigationEdges: graph.edges,
    streetLights: deriveStreetLights(graph.nodes, graph.edges), cameraBounds: deriveCameraBounds(allPoints),
    zones: terrain.areas.map((area) => ({ ...area })),
    propZones: [
      { id: 'outer-rocks-west', center: [terrain.bounds.center[0] - terrain.bounds.width * 0.4, 0], width: 1.8, depth: terrain.bounds.depth * 0.7, density: 'low', seedOffset: candidateIndex * 2 },
      { id: 'outer-rocks-east', center: [terrain.bounds.center[0] + terrain.bounds.width * 0.4, 0], width: 1.8, depth: terrain.bounds.depth * 0.7, density: 'low', seedOffset: candidateIndex * 2 + 1 },
    ],
    score: 0, scoreBreakdown: EMPTY_SCORE,
  };
  const scoreBreakdown = scoreGeneratedLayout(draft);
  const score = totalLayoutScore(scoreBreakdown);
  return { ...draft, score, scoreBreakdown };
}

export function generateLayoutCandidates(options: GenerateLayoutOptions): LayoutGenerationResult {
  const seed = typeof options.seed === 'number' ? options.seed >>> 0 : hashSeed(options.seed);
  const style = options.style ?? NIVALIS_LAYOUT_INTENT.style;
  const terrain = options.terrain ?? NIVALIS_TERRAIN;
  const internalCandidateCount = Math.max(1, Math.min(50, Math.floor(options.internalCandidateCount ?? INTERNAL_CANDIDATE_COUNT)));
  const visualCandidateCount = Math.max(1, Math.min(5, Math.floor(options.visualCandidateCount ?? VISUAL_CANDIDATE_COUNT)));
  const valid: GeneratedPlanetLayout[] = [];
  const reasons = new Set<string>();
  for (let index = 0; index < internalCandidateCount; index += 1) {
    const candidate = buildCandidate(seed, index, style, terrain);
    if (!candidate) { reasons.add('road-generation-failed'); continue; }
    const validation = validateGeneratedLayout(candidate, terrain);
    if (validation.valid) valid.push(candidate); else validation.reasons.forEach((reason) => reasons.add(reason));
  }
  valid.sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId));
  if (valid.length === 0) return { status: 'failure', seed, attemptedCandidates: internalCandidateCount, reasons: [...reasons].sort() };
  return { status: 'success', seed, attemptedCandidates: internalCandidateCount, candidates: valid.slice(0, visualCandidateCount) };
}

export interface SeedSweepReport {
  readonly averageCandidateCount: number;
  readonly averageGenerationMs: number;
  readonly failed: number;
  readonly failures: readonly { readonly reasons: readonly string[]; readonly seed: number }[];
  readonly highestScore: number;
  readonly lowestScore: number;
  readonly testedSeeds: number;
  readonly valid: number;
}

export function runLayoutSeedSweep(count = 100, startingSeed = 1): SeedSweepReport {
  const start = globalThis.performance.now();
  const failures: { reasons: readonly string[]; seed: number }[] = [];
  const scores: number[] = [];
  let candidateCount = 0;
  for (let offset = 0; offset < count; offset += 1) {
    const seed = startingSeed + offset;
    const result = generateLayoutCandidates({ seed });
    if (result.status === 'failure') failures.push({ seed, reasons: result.reasons });
    else { candidateCount += result.candidates.length; scores.push(result.candidates[0]?.score ?? 0); }
  }
  const elapsed = globalThis.performance.now() - start;
  return {
    testedSeeds: count, valid: count - failures.length, failed: failures.length, failures,
    averageCandidateCount: Number((candidateCount / Math.max(1, count - failures.length)).toFixed(2)),
    averageGenerationMs: Number((elapsed / Math.max(1, count)).toFixed(2)),
    highestScore: scores.length ? Math.max(...scores) : 0,
    lowestScore: scores.length ? Math.min(...scores) : 0,
  };
}
