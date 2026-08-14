import type { FacilityId } from '../prototype/types';
import type { DeterministicRng } from './deterministicRng';
import type { CornerMode, StructuralArchetype } from './structuralArchetypes';
import type { LayoutEntityId, Point2, StructuralArchetypeId } from './layoutTypes';

// An archetype only declares design INTENT (which entity links to which, where the expansion hangs
// off, which silhouette family it belongs to). Everything geometric - the skeleton coordinates, the
// bends of every road, how many junction nodes exist, where facilities may be sampled, how they are
// rotated and how the lighting rhythm runs - is materialized per seed from this module. Two seeds
// that pick the same archetype therefore share topology, never geometry.

export const SPINE_ENTITY_ORDER: readonly LayoutEntityId[] = ['solar', 'reactor', 'battery', 'habitat', 'oxygen', 'mine', 'expansion'];
export const FACILITY_PLAN_ORDER: readonly FacilityId[] = ['habitat', 'oxygen', 'battery', 'reactor', 'solar', 'mine'];

const ANCHOR_LIMIT = { maxX: 0.9, maxZ: 0.62, minX: -0.88, minZ: -0.62 } as const;
const WAYPOINT_LIMIT = { maxX: 0.94, maxZ: 0.68, minX: -0.94, minZ: -0.68 } as const;
const MINE_MINIMUM_X = 0.46;
const ROTATION_QUANTA: readonly number[] = [0, 0, 0, Math.PI / 16, Math.PI / 12, Math.PI / 8];

const round = (value: number) => Number(value.toFixed(4));
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export interface SpineSegmentPlan {
  readonly edgeId: string;
  readonly from: string;
  readonly to: string;
  readonly waypoints: readonly Point2[];
}

export interface SpineJunction {
  readonly id: string;
  readonly position: Point2;
}

export interface FacilityPlacementPlan {
  readonly approachDistance: number;
  readonly explorationNoise: number;
  readonly gridColumns: number;
  readonly gridJitter: number;
  readonly gridRows: number;
  readonly ringCount: number;
  readonly ringRadiusScale: number;
  readonly ringStartAngle: number;
  readonly rotationOffset: number;
  readonly rotationQuantum: number;
  readonly sampleWindowCenter: Point2;
  readonly sampleWindowScale: number;
  readonly side: number;
}

export interface StreetLightPlan {
  readonly approachEntities: readonly FacilityId[];
  readonly lateralOffset: number;
  readonly minimumSeparation: number;
  readonly nodeOffsetAngle: number;
  readonly nodeOffsetRadius: number;
  readonly spacing: number;
  readonly spacingJitter: number;
  readonly startOffset: number;
}

export interface PlateauPlan {
  readonly angularJitter: readonly number[];
  readonly extraVertices: readonly { readonly edgeIndex: number; readonly offset: number }[];
  readonly radialJitter: readonly number[];
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleZ: number;
}

export interface PropZonePlan {
  readonly depthScale: number;
  readonly lateralShift: number;
  readonly seedOffset: number;
  readonly side: number;
  readonly width: number;
}

export interface MaterializedArchetype {
  readonly anchors: Readonly<Record<LayoutEntityId, Point2>>;
  readonly base: StructuralArchetype;
  readonly expansionRelation: StructuralArchetype['expansionRelation'];
  readonly facilityPlans: Readonly<Record<FacilityId, FacilityPlacementPlan>>;
  readonly id: StructuralArchetypeId;
  readonly junctions: readonly SpineJunction[];
  readonly mainSpineOrientation: StructuralArchetype['mainSpineOrientation'];
  readonly plateauPlan: PlateauPlan;
  readonly propZonePlans: readonly PropZonePlan[];
  readonly segments: readonly SpineSegmentPlan[];
  readonly streetLightPlan: StreetLightPlan;
  readonly variationKey: string;
}

export const spineNodeId = (entity: LayoutEntityId): string => `spine-${entity}`;
export const isJunctionNodeId = (id: string): boolean => id.startsWith('spine-link-');

function pick<T>(pool: readonly T[], rng: DeterministicRng): T {
  const value = pool[Math.floor(rng.next() * pool.length) % pool.length];
  if (value === undefined) throw new Error('Cannot pick from an empty variation pool.');
  return value;
}

function clampAnchor(entity: LayoutEntityId, base: Point2, candidate: Point2, driftX: number, driftZ: number): Point2 {
  const x = clamp(clamp(candidate[0], base[0] - driftX, base[0] + driftX), ANCHOR_LIMIT.minX, ANCHOR_LIMIT.maxX);
  const z = clamp(clamp(candidate[1], base[1] - driftZ, base[1] + driftZ), ANCHOR_LIMIT.minZ, ANCHOR_LIMIT.maxZ);
  return [round(entity === 'mine' ? Math.max(MINE_MINIMUM_X, x) : x), round(z)];
}

// The skeleton is deformed as a whole (rotate + scale + shear + shift) and then each anchor gets its
// own jitter. The global deformation keeps the archetype recognisable, the per-anchor jitter makes
// the concrete arrangement unique; both are finally clamped back into the archetype's drift budget.
function deriveAnchors(base: StructuralArchetype, rng: DeterministicRng): Record<LayoutEntityId, Point2> {
  const angle = rng.range(-0.16, 0.16);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const scaleX = rng.range(0.88, 1.14);
  const scaleZ = rng.range(0.82, 1.2);
  const shear = rng.range(-0.12, 0.12);
  const shiftX = rng.range(-0.07, 0.07);
  const shiftZ = rng.range(-0.1, 0.1);
  const [driftX, driftZ] = base.variation.maxDrift;
  const anchors = {} as Record<LayoutEntityId, Point2>;
  for (const entity of SPINE_ENTITY_ORDER) {
    const anchorBase = base.attachmentTargets[entity];
    const sheared: Point2 = [anchorBase[0] * scaleX + anchorBase[1] * shear, anchorBase[1] * scaleZ];
    const rotated: Point2 = [sheared[0] * cosine - sheared[1] * sine + shiftX, sheared[0] * sine + sheared[1] * cosine + shiftZ];
    const jittered: Point2 = [rotated[0] + rng.range(-driftX * 0.55, driftX * 0.55), rotated[1] + rng.range(-driftZ * 0.55, driftZ * 0.55)];
    anchors[entity] = clampAnchor(entity, anchorBase, jittered, driftX, driftZ);
  }
  return anchors;
}

function clampWaypoint(candidate: Point2): Point2 {
  return [round(clamp(candidate[0], WAYPOINT_LIMIT.minX, WAYPOINT_LIMIT.maxX)), round(clamp(candidate[1], WAYPOINT_LIMIT.minZ, WAYPOINT_LIMIT.maxZ))];
}

function deriveWaypoints(mode: CornerMode, from: Point2, to: Point2, rng: DeterministicRng): readonly Point2[] {
  const bend = rng.range(0.3, 0.72);
  const deltaX = to[0] - from[0];
  const deltaZ = to[1] - from[1];
  switch (mode) {
    case 'direct':
      return [];
    case 'elbow-x':
      return [clampWaypoint([to[0], from[1]])];
    case 'elbow-z':
      return [clampWaypoint([from[0], to[1]])];
    case 'dogleg-x': {
      const middle = from[0] + deltaX * bend;
      return [clampWaypoint([middle, from[1]]), clampWaypoint([middle, to[1]])];
    }
    case 'dogleg-z': {
      const middle = from[1] + deltaZ * bend;
      return [clampWaypoint([from[0], middle]), clampWaypoint([to[0], middle])];
    }
    default: {
      const length = Math.max(0.001, Math.hypot(deltaX, deltaZ));
      const offset = rng.range(0.06, 0.17) * (rng.next() < 0.5 ? -1 : 1);
      return [clampWaypoint([from[0] + deltaX * bend - deltaZ / length * offset, from[1] + deltaZ * bend + deltaX / length * offset])];
    }
  }
}

const degenerate = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.02;

function compactPolyline(points: readonly Point2[]): readonly Point2[] {
  const compacted: Point2[] = [];
  for (const candidate of points) {
    const previous = compacted[compacted.length - 1];
    if (previous && degenerate(previous, candidate)) continue;
    compacted.push(candidate);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (compacted.length < 2 && first && last) return [first, last];
  return compacted;
}

interface DraftSegment {
  readonly from: string;
  readonly polyline: readonly Point2[];
  readonly to: string;
}

function deriveSegments(base: StructuralArchetype, anchors: Record<LayoutEntityId, Point2>, rng: DeterministicRng): { readonly junctions: readonly SpineJunction[]; readonly segments: readonly SpineSegmentPlan[] } {
  // A 'bowed' leg can collapse back to a straight during path simplification, so only elbow/dogleg
  // modes count towards the archetype's guaranteed corner budget.
  const modes = base.mainConnections.map(() => pick(base.variation.cornerModes, rng));
  const isHardCorner = (mode: CornerMode) => mode !== 'direct' && mode !== 'bowed';
  const upgradable = base.variation.cornerModes.filter(isHardCorner);
  const cornerCount = () => modes.filter(isHardCorner).length;
  for (let guard = 0; guard < modes.length && upgradable.length > 0 && cornerCount() < base.variation.minCorners; guard += 1) {
    const straightIndices = modes.flatMap((mode, index) => isHardCorner(mode) ? [] : [index]);
    const target = straightIndices[Math.floor(rng.next() * Math.max(1, straightIndices.length)) % Math.max(1, straightIndices.length)];
    if (target === undefined) break;
    modes[target] = pick(upgradable, rng);
  }

  const drafts: DraftSegment[] = base.mainConnections.map(([from, to], index) => ({
    from: spineNodeId(from),
    to: spineNodeId(to),
    polyline: compactPolyline([anchors[from], ...deriveWaypoints(modes[index] ?? 'direct', anchors[from], anchors[to], rng), anchors[to]]),
  }));

  // Extra junction nodes split an existing leg in two. The road shape is unchanged, but the
  // navigation graph gains a real node, so the spine node count itself varies per seed.
  const [minimumLinks, maximumLinks] = base.variation.linkJunctions;
  const linkCount = minimumLinks + Math.floor(rng.next() * Math.max(1, maximumLinks - minimumLinks + 1));
  const junctions: SpineJunction[] = [];
  for (let link = 0; link < linkCount; link += 1) {
    const draftIndex = Math.floor(rng.next() * drafts.length) % drafts.length;
    const draft = drafts[draftIndex];
    if (!draft || draft.polyline.length < 2) continue;
    const legIndex = Math.floor(rng.next() * (draft.polyline.length - 1)) % (draft.polyline.length - 1);
    const start = draft.polyline[legIndex];
    const end = draft.polyline[legIndex + 1];
    if (!start || !end) continue;
    const ratio = rng.range(0.32, 0.68);
    const position = clampWaypoint([start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio]);
    if (degenerate(position, start) || degenerate(position, end)) continue;
    const id = `spine-link-${junctions.length}`;
    junctions.push({ id, position });
    drafts.splice(draftIndex, 1,
      { from: draft.from, to: id, polyline: [...draft.polyline.slice(0, legIndex + 1), position] },
      { from: id, to: draft.to, polyline: [position, ...draft.polyline.slice(legIndex + 1)] });
  }

  const segments = drafts.map((draft, index) => ({ edgeId: `main-spine-${index}`, from: draft.from, to: draft.to, waypoints: draft.polyline.slice(1, -1) }));
  return { junctions, segments };
}

function deriveFacilityPlan(rng: DeterministicRng): FacilityPlacementPlan {
  return {
    approachDistance: rng.range(1.6, 4.2),
    explorationNoise: rng.range(0.6, 4.6),
    gridColumns: 4 + Math.floor(rng.next() * 4),
    gridJitter: rng.range(0.28, 0.92),
    gridRows: 3 + Math.floor(rng.next() * 4),
    ringCount: 6 + Math.floor(rng.next() * 7),
    ringRadiusScale: rng.range(0.85, 1.85),
    ringStartAngle: rng.range(0, Math.PI * 2),
    rotationOffset: rng.range(-0.44, 0.44),
    rotationQuantum: pick(ROTATION_QUANTA, rng),
    sampleWindowCenter: [rng.range(-1, 1), rng.range(-1, 1)],
    sampleWindowScale: rng.range(0.58, 1),
    side: rng.next() < 0.5 ? -1 : 1,
  };
}

function deriveStreetLightPlan(rng: DeterministicRng): StreetLightPlan {
  const approachCount = 2 + Math.floor(rng.next() * 5);
  const shuffled = [...FACILITY_PLAN_ORDER]
    .map((id) => ({ id, order: rng.next() }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map(({ id }) => id);
  return {
    approachEntities: shuffled.slice(0, approachCount).sort((a, b) => a.localeCompare(b)),
    lateralOffset: rng.range(0.45, 1.5),
    minimumSeparation: rng.range(1.7, 3.4),
    nodeOffsetAngle: rng.range(0, Math.PI * 2),
    nodeOffsetRadius: rng.range(0.4, 1.2),
    spacing: rng.range(5.5, 13.5),
    spacingJitter: rng.range(0, 2.2),
    startOffset: rng.range(0.9, 4.2),
  };
}

function derivePlateauPlan(vertexCount: number, rng: DeterministicRng): PlateauPlan {
  const extraCount = Math.floor(rng.next() * 4);
  return {
    angularJitter: Array.from({ length: vertexCount }, () => rng.range(-0.07, 0.07)),
    extraVertices: Array.from({ length: extraCount }, () => ({ edgeIndex: Math.floor(rng.next() * vertexCount), offset: rng.range(-0.06, 0.14) })),
    radialJitter: Array.from({ length: vertexCount }, () => rng.range(0.86, 1.16)),
    rotation: rng.range(-0.26, 0.26),
    scaleX: rng.range(0.9, 1.12),
    scaleZ: rng.range(0.88, 1.14),
  };
}

function derivePropZonePlans(rng: DeterministicRng): readonly PropZonePlan[] {
  const count = 2 + Math.floor(rng.next() * 3);
  return Array.from({ length: count }, (_unused, index) => ({
    depthScale: rng.range(0.34, 0.78),
    lateralShift: rng.range(-0.4, 0.4),
    seedOffset: Math.floor(rng.range(0, 64)) + index,
    side: index % 2 === 0 ? -1 : 1,
    width: rng.range(1.3, 3.1),
  }));
}

function variationKeyOf(anchors: Record<LayoutEntityId, Point2>, segments: readonly SpineSegmentPlan[], junctions: readonly SpineJunction[]): string {
  const anchorText = SPINE_ENTITY_ORDER.map((entity) => anchors[entity].join(',')).join(';');
  const roadText = segments.map((segment) => `${segment.from}>${segment.to}:${segment.waypoints.map((waypoint) => waypoint.join(',')).join('|')}`).join(';');
  let hash = 2166136261;
  for (const text of [anchorText, roadText, String(junctions.length)]) {
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

export function materializeArchetype(base: StructuralArchetype, rng: DeterministicRng, plateauVertexCount: number): MaterializedArchetype {
  const anchors = deriveAnchors(base, rng);
  const { junctions, segments } = deriveSegments(base, anchors, rng);
  const facilityPlans = Object.fromEntries(FACILITY_PLAN_ORDER.map((id) => [id, deriveFacilityPlan(rng)])) as Record<FacilityId, FacilityPlacementPlan>;
  return {
    anchors,
    base,
    expansionRelation: base.expansionRelation,
    facilityPlans,
    id: base.id,
    junctions,
    mainSpineOrientation: base.mainSpineOrientation,
    plateauPlan: derivePlateauPlan(plateauVertexCount, rng),
    propZonePlans: derivePropZonePlans(rng),
    segments,
    streetLightPlan: deriveStreetLightPlan(rng),
    variationKey: variationKeyOf(anchors, segments, junctions),
  };
}
