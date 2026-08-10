import type { FacilityId } from '../prototype/types';

export type Point2 = readonly [x: number, z: number];
export type LayoutStyle = 'Compact' | 'Distributed' | 'Linear';
export type StructuralArchetypeId = 'central-spine' | 'l-shaped' | 'offset-hub' | 'split-core' | 't-junction';
export type HabitatVisualVariantId = 'clustered-habitat' | 'compact-pod' | 'courtyard' | 'linear-compound' | 'service-yard';
export type TerrainVisualVariantId = 'elongated' | 'offset-industrial-shelf' | 'split-ledge' | 'wide-central-shelf';
export type TerrainTag = 'blocked' | 'buildable' | 'hazardZone' | 'preferredExpansionArea' | 'resourceZone';
export type OperationalZone = 'Emergency' | 'Energy' | 'Industrial' | 'LifeSupport' | 'Residential';
export type LayoutEntityId = FacilityId | 'expansion';

export interface Rect2 {
  readonly center: Point2;
  readonly depth: number;
  readonly width: number;
}

export interface TerrainArea extends Rect2 {
  readonly id: string;
  readonly operationalZone?: OperationalZone;
  readonly tags: readonly TerrainTag[];
}

export interface TerrainDefinition {
  readonly areas: readonly TerrainArea[];
  readonly bounds: Rect2;
  readonly id: string;
}

export interface NeighbourPreference {
  readonly facilityId: FacilityId;
  readonly maxDistance?: number;
  readonly minDistance?: number;
  readonly weight: number;
}

export interface PlacementProfile {
  readonly accessPoints: readonly ['entrance', 'workPoint'];
  readonly avoidedNeighbours: readonly NeighbourPreference[];
  readonly expansionCompatibility: readonly string[];
  readonly forbiddenTerrainTags: readonly TerrainTag[];
  readonly minimumSeparation: number;
  readonly orientationBehavior: 'anchor-facing' | 'fixed' | 'free-90' | 'road-facing';
  readonly preferredNeighbours: readonly NeighbourPreference[];
  readonly preferredZones: readonly OperationalZone[];
  readonly requiredTerrainTags: readonly TerrainTag[];
  readonly requiresRoad: boolean;
  readonly serviceClearance: number;
}

export interface GeneratedFacilityPlacement {
  readonly entrance: Point2;
  readonly footprint: Rect2;
  readonly id: FacilityId;
  readonly position: Point2;
  readonly primaryAssetId: string;
  readonly rotationY: number;
  readonly serviceClearance: number;
  readonly visualFootprint: Rect2;
  readonly visualModules: readonly GeneratedVisualModule[];
  readonly visualVariantId: string;
  readonly workPoint: Point2;
}

export interface GeneratedVisualModule {
  readonly assetId: string;
  readonly localPosition: Point2;
  readonly rotationY: number;
  readonly scale: number;
  readonly semanticVisualRole: 'annex' | 'connector' | 'panel' | 'plaza' | 'service-prop' | 'technical-module';
}

export interface GeneratedExpansionSlot {
  readonly accessNodeId: string;
  readonly compatibility: readonly string[];
  readonly footprintCapacity: { readonly depth: number; readonly width: number };
  readonly id: 'expansion';
  readonly position: Point2;
  readonly primaryAssetId: 'expansion-pad';
  readonly rotationY: number;
}

export interface NavigationNode {
  readonly entityId?: LayoutEntityId;
  readonly id: string;
  readonly kind: 'approach' | 'entrance' | 'spine';
  readonly position: Point2;
}

export interface NavigationEdge {
  readonly from: string;
  readonly id: string;
  readonly role: 'entrance-link' | 'main-spine' | 'service';
  readonly to: string;
}

export interface GeneratedRoad {
  readonly edgeId: string;
  readonly points: readonly Point2[];
  readonly role: NavigationEdge['role'];
}

export interface StreetLightPlacement {
  readonly id: string;
  readonly reason: 'approach' | 'intermediate' | 'junction';
  readonly position: Point2;
  readonly roadNodeId?: string;
}

export interface GeneratedZone extends Rect2 {
  readonly id: string;
  readonly operationalZone?: OperationalZone;
  readonly tags: readonly TerrainTag[];
}

export interface PropZone extends Rect2 {
  readonly density: 'low';
  readonly id: string;
  readonly seedOffset: number;
}

export interface CameraBounds {
  readonly center: Point2;
  readonly maxX: number;
  readonly maxZ: number;
  readonly minX: number;
  readonly minZ: number;
}

export interface LayoutScoreBreakdown {
  readonly adjacency: number;
  readonly cameraReadability: number;
  readonly compactness: number;
  readonly expansionAccess: number;
  readonly roadQuality: number;
  readonly safetySeparation: number;
  readonly screenSpaceOverlap: number;
  readonly terrainUsage: number;
  readonly visualComposition: number;
}

export interface GeneratedPlanetLayout {
  readonly cameraBounds: CameraBounds;
  readonly candidateId: string;
  readonly expansionSlots: readonly GeneratedExpansionSlot[];
  readonly facilities: readonly GeneratedFacilityPlacement[];
  readonly generatorVersion: string;
  readonly plateauVertices: readonly Point2[];
  readonly navigationEdges: readonly NavigationEdge[];
  readonly navigationNodes: readonly NavigationNode[];
  readonly planetId: 'nivalis-3-prototype';
  readonly propZones: readonly PropZone[];
  readonly roads: readonly GeneratedRoad[];
  readonly score: number;
  readonly scoreBreakdown: LayoutScoreBreakdown;
  readonly seed: number;
  readonly streetLights: readonly StreetLightPlacement[];
  readonly style: LayoutStyle;
  readonly structure: LayoutStructureSummary;
  readonly zones: readonly GeneratedZone[];
}

export interface LayoutStructureSummary {
  readonly archetype: StructuralArchetypeId;
  readonly clusterAssignments: Readonly<Record<FacilityId, 'core' | 'energy' | 'industrial' | 'life-support'>>;
  readonly differenceScore: number;
  readonly expansionRelation: 'east-road-end' | 'north-side-branch' | 'south-outer-shelf' | 'west-road-end';
  readonly habitatVariant: HabitatVisualVariantId;
  readonly junctionCount: number;
  readonly mainSpineOrientation: 'diagonal' | 'horizontal' | 'mixed' | 'vertical';
  readonly roadTurningPattern: readonly ('corner' | 'straight')[];
  readonly signature: string;
  readonly terrainVariant: TerrainVisualVariantId;
  readonly visualModuleCount: number;
}

export interface LayoutFailure {
  readonly attemptedCandidates: number;
  readonly reasons: readonly string[];
  readonly seed: number;
  readonly status: 'failure';
}

export interface LayoutGenerationSuccess {
  readonly candidates: readonly GeneratedPlanetLayout[];
  readonly attemptedCandidates: number;
  readonly seed: number;
  readonly status: 'success';
}

export type LayoutGenerationResult = LayoutFailure | LayoutGenerationSuccess;
