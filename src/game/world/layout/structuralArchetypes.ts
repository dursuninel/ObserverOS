import type { FacilityId } from '../prototype/types';
import type { HabitatVisualVariantId, Point2, StructuralArchetypeId, TerrainVisualVariantId } from './layoutTypes';

export interface StructuralArchetype {
  readonly attachmentTargets: Readonly<Record<FacilityId | 'expansion', Point2>>;
  readonly expansionRelation: 'east-road-end' | 'north-side-branch' | 'south-outer-shelf' | 'west-road-end';
  readonly habitatVariants: readonly HabitatVisualVariantId[];
  readonly id: StructuralArchetypeId;
  readonly junctionCount: number;
  readonly mainSpineOrientation: 'diagonal' | 'horizontal' | 'mixed' | 'vertical';
  readonly mainConnections: readonly (readonly [FacilityId | 'expansion', FacilityId | 'expansion'])[];
  readonly routeCorners: Readonly<Partial<Record<`${FacilityId | 'expansion'}>${FacilityId | 'expansion'}`, readonly Point2[]>>>;
  readonly terrainVariants: readonly TerrainVisualVariantId[];
}

// Normalized design-graph anchors. They describe topology, not final facility coordinates.
export const STRUCTURAL_ARCHETYPES: readonly StructuralArchetype[] = [
  {
    id: 'central-spine', mainSpineOrientation: 'horizontal', junctionCount: 2, expansionRelation: 'east-road-end',
    habitatVariants: ['compact-pod', 'service-yard'], terrainVariants: ['elongated', 'wide-central-shelf'],
    mainConnections: [['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['habitat', 'oxygen'], ['oxygen', 'mine'], ['mine', 'expansion']],
    attachmentTargets: { solar: [-0.78, 0.18], reactor: [-0.55, -0.2], battery: [-0.3, 0.18], habitat: [0.05, -0.2], oxygen: [0.3, 0.18], mine: [0.62, -0.22], expansion: [0.86, 0.2] },
    routeCorners: {},
  },
  {
    id: 'l-shaped', mainSpineOrientation: 'mixed', junctionCount: 1, expansionRelation: 'south-outer-shelf',
    habitatVariants: ['linear-compound', 'courtyard'], terrainVariants: ['offset-industrial-shelf', 'wide-central-shelf'],
    mainConnections: [['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['habitat', 'oxygen'], ['oxygen', 'mine'], ['mine', 'expansion']],
    attachmentTargets: { solar: [-0.72, 0.34], reactor: [-0.48, 0.34], battery: [-0.22, 0.34], habitat: [0.08, 0.28], oxygen: [0.1, -0.05], mine: [0.44, -0.45], expansion: [0.75, -0.48] },
    routeCorners: { 'battery>habitat': [[-0.05, 0.34]], 'habitat>oxygen': [[0.1, 0.16]], 'oxygen>mine': [[0.1, -0.45]] },
  },
  {
    id: 't-junction', mainSpineOrientation: 'mixed', junctionCount: 3, expansionRelation: 'north-side-branch',
    habitatVariants: ['courtyard', 'clustered-habitat'], terrainVariants: ['wide-central-shelf', 'split-ledge'],
    mainConnections: [['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['battery', 'oxygen'], ['oxygen', 'mine'], ['oxygen', 'expansion']],
    attachmentTargets: { solar: [-0.65, 0.05], reactor: [-0.38, 0.05], battery: [-0.12, 0.05], habitat: [0.08, -0.28], oxygen: [0.08, 0.34], mine: [0.48, 0.05], expansion: [0.72, 0.4] },
    routeCorners: { 'battery>habitat': [[0.08, 0.05]], 'oxygen>mine': [[0.08, 0.05]] },
  },
  {
    id: 'offset-hub', mainSpineOrientation: 'diagonal', junctionCount: 3, expansionRelation: 'west-road-end',
    habitatVariants: ['clustered-habitat', 'service-yard'], terrainVariants: ['offset-industrial-shelf', 'split-ledge'],
    mainConnections: [['expansion', 'solar'], ['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['battery', 'oxygen'], ['oxygen', 'mine']],
    attachmentTargets: { solar: [-0.7, 0.42], reactor: [-0.48, 0.1], battery: [-0.2, 0.25], habitat: [0.05, -0.05], oxygen: [0.26, 0.25], mine: [0.62, -0.35], expansion: [-0.82, -0.32] },
    routeCorners: { 'reactor>battery': [[-0.34, 0.25]], 'battery>habitat': [[0.05, 0.25]], 'battery>oxygen': [[0.05, 0.25]], 'oxygen>mine': [[0.38, -0.05]] },
  },
  {
    id: 'split-core', mainSpineOrientation: 'mixed', junctionCount: 2, expansionRelation: 'south-outer-shelf',
    habitatVariants: ['linear-compound', 'clustered-habitat'], terrainVariants: ['split-ledge', 'elongated'],
    mainConnections: [['solar', 'reactor'], ['reactor', 'battery'], ['battery', 'habitat'], ['habitat', 'oxygen'], ['oxygen', 'mine'], ['habitat', 'expansion']],
    attachmentTargets: { solar: [-0.72, 0.35], reactor: [-0.52, 0.05], battery: [-0.28, 0.26], habitat: [0.25, -0.18], oxygen: [0.42, 0.15], mine: [0.7, -0.38], expansion: [-0.18, -0.58] },
    routeCorners: { 'battery>habitat': [[-0.05, 0.02]], 'oxygen>mine': [[0.58, 0.02]], 'habitat>expansion': [[0.25, -0.58]] },
  },
] as const;

export function getStructuralArchetype(id: StructuralArchetypeId): StructuralArchetype {
  const archetype = STRUCTURAL_ARCHETYPES.find((candidate) => candidate.id === id);
  if (!archetype) throw new Error(`Unknown structural archetype: ${id}`);
  return archetype;
}
