import type { FacilityId } from '../prototype/types';
import type { HabitatVisualVariantId, Point2, StructuralArchetypeId, TerrainVisualVariantId } from './layoutTypes';

export type CornerMode = 'bowed' | 'direct' | 'dogleg-x' | 'dogleg-z' | 'elbow-x' | 'elbow-z';

// Per-archetype variation budget. It never fixes geometry, it only bounds how far the per-seed
// materialization (see archetypeVariation.ts) is allowed to travel from the design intent.
export interface ArchetypeVariation {
  /** Weighted pool the per-seed road bend of each main connection is drawn from. */
  readonly cornerModes: readonly CornerMode[];
  /** Inclusive [minimum, maximum] number of extra junction nodes injected into the spine. */
  readonly linkJunctions: readonly [number, number];
  /** Maximum normalized drift of a skeleton anchor away from its design position. */
  readonly maxDrift: Point2;
  /** Lower bound on non-straight main connections, so the archetype keeps its silhouette. */
  readonly minCorners: number;
}

export interface StructuralArchetype {
  readonly attachmentTargets: Readonly<Record<FacilityId | 'expansion', Point2>>;
  readonly expansionRelation: 'east-road-end' | 'north-side-branch' | 'south-outer-shelf' | 'west-road-end';
  readonly habitatVariants: readonly HabitatVisualVariantId[];
  readonly id: StructuralArchetypeId;
  readonly mainSpineOrientation: 'diagonal' | 'horizontal' | 'mixed' | 'vertical';
  readonly mainConnections: readonly (readonly [FacilityId | 'expansion', FacilityId | 'expansion'])[];
  readonly terrainVariants: readonly TerrainVisualVariantId[];
  readonly variation: ArchetypeVariation;
}

// Normalized design-graph anchors. They describe topology and design intent, not final coordinates:
// the concrete skeleton, road bends and junction count are materialized per seed.
export const STRUCTURAL_ARCHETYPES: readonly StructuralArchetype[] = [
  {
    id: 'central-spine', mainSpineOrientation: 'horizontal', expansionRelation: 'east-road-end',
    habitatVariants: ['compact-pod', 'service-yard'], terrainVariants: ['elongated', 'wide-central-shelf'],
    mainConnections: [['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['habitat', 'oxygen'], ['oxygen', 'mine'], ['mine', 'expansion']],
    attachmentTargets: { solar: [-0.78, 0.18], reactor: [-0.55, -0.2], battery: [-0.3, 0.18], habitat: [0.05, -0.2], oxygen: [0.3, 0.18], mine: [0.62, -0.22], expansion: [0.86, 0.2] },
    variation: { cornerModes: ['direct', 'direct', 'elbow-z', 'dogleg-z', 'bowed'], linkJunctions: [1, 3], maxDrift: [0.13, 0.24], minCorners: 1 },
  },
  {
    id: 'l-shaped', mainSpineOrientation: 'mixed', expansionRelation: 'south-outer-shelf',
    habitatVariants: ['linear-compound', 'courtyard'], terrainVariants: ['offset-industrial-shelf', 'wide-central-shelf'],
    mainConnections: [['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['habitat', 'oxygen'], ['oxygen', 'mine'], ['mine', 'expansion']],
    attachmentTargets: { solar: [-0.72, 0.34], reactor: [-0.48, 0.34], battery: [-0.22, 0.34], habitat: [0.08, 0.28], oxygen: [0.1, -0.05], mine: [0.44, -0.45], expansion: [0.75, -0.48] },
    variation: { cornerModes: ['elbow-x', 'elbow-z', 'dogleg-x', 'dogleg-z', 'bowed', 'direct'], linkJunctions: [1, 3], maxDrift: [0.12, 0.21], minCorners: 2 },
  },
  {
    id: 't-junction', mainSpineOrientation: 'mixed', expansionRelation: 'north-side-branch',
    habitatVariants: ['courtyard', 'clustered-habitat'], terrainVariants: ['wide-central-shelf', 'split-ledge'],
    mainConnections: [['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['battery', 'oxygen'], ['oxygen', 'mine'], ['oxygen', 'expansion']],
    attachmentTargets: { solar: [-0.65, 0.05], reactor: [-0.38, 0.05], battery: [-0.12, 0.05], habitat: [0.08, -0.28], oxygen: [0.08, 0.34], mine: [0.48, 0.05], expansion: [0.72, 0.4] },
    variation: { cornerModes: ['direct', 'elbow-x', 'elbow-z', 'dogleg-z', 'bowed'], linkJunctions: [1, 3], maxDrift: [0.14, 0.22], minCorners: 1 },
  },
  {
    id: 'offset-hub', mainSpineOrientation: 'diagonal', expansionRelation: 'west-road-end',
    habitatVariants: ['clustered-habitat', 'service-yard'], terrainVariants: ['offset-industrial-shelf', 'split-ledge'],
    mainConnections: [['expansion', 'solar'], ['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['battery', 'oxygen'], ['oxygen', 'mine']],
    attachmentTargets: { solar: [-0.7, 0.42], reactor: [-0.48, 0.1], battery: [-0.2, 0.25], habitat: [0.05, -0.05], oxygen: [0.26, 0.25], mine: [0.62, -0.35], expansion: [-0.82, -0.32] },
    variation: { cornerModes: ['elbow-x', 'elbow-z', 'dogleg-x', 'bowed', 'direct'], linkJunctions: [1, 4], maxDrift: [0.14, 0.2], minCorners: 2 },
  },
  {
    id: 'split-core', mainSpineOrientation: 'mixed', expansionRelation: 'south-outer-shelf',
    habitatVariants: ['linear-compound', 'clustered-habitat'], terrainVariants: ['split-ledge', 'elongated'],
    mainConnections: [['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['habitat', 'oxygen'], ['oxygen', 'mine'], ['habitat', 'expansion']],
    attachmentTargets: { solar: [-0.72, 0.35], reactor: [-0.52, 0.05], battery: [-0.28, 0.26], habitat: [0.25, -0.18], oxygen: [0.42, 0.15], mine: [0.7, -0.38], expansion: [-0.18, -0.58] },
    variation: { cornerModes: ['direct', 'elbow-z', 'dogleg-x', 'dogleg-z', 'bowed'], linkJunctions: [1, 3], maxDrift: [0.14, 0.22], minCorners: 2 },
  },
] as const;

export function getStructuralArchetype(id: StructuralArchetypeId): StructuralArchetype {
  const archetype = STRUCTURAL_ARCHETYPES.find((candidate) => candidate.id === id);
  if (!archetype) throw new Error(`Unknown structural archetype: ${id}`);
  return archetype;
}
