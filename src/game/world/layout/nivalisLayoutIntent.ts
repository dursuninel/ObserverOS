import type { FacilityId } from '../prototype/types';
import type { LayoutStyle, PlacementProfile, TerrainDefinition } from './layoutTypes';

export const GENERATOR_VERSION = '5.0.0';
export const INTERNAL_CANDIDATE_COUNT = 50;
export const VISUAL_CANDIDATE_COUNT = 5;

export const NIVALIS_FACILITY_ASSETS: Readonly<Record<FacilityId, string>> = Object.freeze({
  battery: 'battery-body',
  habitat: 'habitat',
  mine: 'mine-drill',
  oxygen: 'oxygen',
  reactor: 'reactor-body',
  solar: 'solar-panel',
});

const profile = (value: PlacementProfile): PlacementProfile => Object.freeze(value);
const shared = {
  accessPoints: ['entrance', 'workPoint'] as const,
  expansionCompatibility: [] as readonly string[],
  forbiddenTerrainTags: ['blocked', 'hazardZone'] as const,
  minimumSeparation: 0.55,
  orientationBehavior: 'road-facing' as const,
  requiredTerrainTags: ['buildable'] as const,
  requiresRoad: true,
  serviceClearance: 0.65,
};

export const NIVALIS_PLACEMENT_PROFILES: Readonly<Record<FacilityId, PlacementProfile>> = Object.freeze({
  habitat: profile({ ...shared, preferredZones: ['Residential'], preferredNeighbours: [{ facilityId: 'oxygen', maxDistance: 9, weight: 1 }], avoidedNeighbours: [{ facilityId: 'mine', minDistance: 7, weight: 1 }, { facilityId: 'reactor', minDistance: 6, weight: 1 }] }),
  oxygen: profile({ ...shared, preferredZones: ['LifeSupport'], preferredNeighbours: [{ facilityId: 'habitat', maxDistance: 9, weight: 1 }], avoidedNeighbours: [{ facilityId: 'reactor', minDistance: 5, weight: 0.7 }] }),
  battery: profile({ ...shared, preferredZones: ['Energy'], preferredNeighbours: [{ facilityId: 'reactor', maxDistance: 9, weight: 1 }], avoidedNeighbours: [] }),
  reactor: profile({ ...shared, preferredZones: ['Energy'], preferredNeighbours: [{ facilityId: 'battery', maxDistance: 9, weight: 1 }], avoidedNeighbours: [{ facilityId: 'habitat', minDistance: 6, weight: 1 }] }),
  solar: profile({ ...shared, preferredZones: ['Energy'], preferredNeighbours: [{ facilityId: 'battery', maxDistance: 10, weight: 0.7 }], avoidedNeighbours: [] }),
  mine: profile({ ...shared, preferredZones: ['Industrial'], requiredTerrainTags: ['buildable', 'resourceZone'], preferredNeighbours: [], avoidedNeighbours: [{ facilityId: 'habitat', minDistance: 7, weight: 1 }] }),
});

export interface NivalisLayoutIntent {
  readonly adjacency: readonly { readonly a: FacilityId; readonly b: FacilityId; readonly priority: 'A' | 'H' | 'L' | 'M' }[];
  readonly planetId: 'nivalis-3-prototype';
  readonly requiredFacilities: readonly FacilityId[];
  readonly style: LayoutStyle;
}

export const NIVALIS_LAYOUT_INTENT: NivalisLayoutIntent = {
  adjacency: [
    { a: 'habitat', b: 'oxygen', priority: 'H' },
    { a: 'battery', b: 'reactor', priority: 'H' },
    { a: 'solar', b: 'battery', priority: 'M' },
    { a: 'habitat', b: 'mine', priority: 'A' },
    { a: 'habitat', b: 'reactor', priority: 'L' },
  ],
  planetId: 'nivalis-3-prototype',
  requiredFacilities: ['solar', 'reactor', 'battery', 'habitat', 'oxygen', 'mine'],
  style: 'Compact',
};

export const NIVALIS_TERRAIN: TerrainDefinition = {
  id: 'nivalis-frozen-plateau',
  bounds: { center: [0, 0], width: 44, depth: 30 },
  areas: [
    { id: 'buildable-plateau', center: [0, 0], width: 43, depth: 29, tags: ['buildable'] },
    { id: 'energy-west', center: [-9, 1], width: 18, depth: 24, tags: ['buildable'], operationalZone: 'Energy' },
    { id: 'colony-core', center: [1, -1], width: 19, depth: 23, tags: ['buildable'], operationalZone: 'Residential' },
    { id: 'life-support-core', center: [5, 1], width: 17, depth: 22, tags: ['buildable'], operationalZone: 'LifeSupport' },
    { id: 'mine-deposit', center: [15, -1], width: 12, depth: 23, tags: ['buildable', 'resourceZone'], operationalZone: 'Industrial' },
    { id: 'expansion-east', center: [18, 8], width: 7, depth: 8, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'expansion-south', center: [-8, -11], width: 11, depth: 7, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'expansion-north', center: [8, 12], width: 9, depth: 5, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'expansion-west', center: [-18, -8], width: 7, depth: 8, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'northwest-ridge', center: [-20, 12.5], width: 2.5, depth: 2.5, tags: ['blocked'] },
    { id: 'southeast-crevasse', center: [20, -12.5], width: 2.4, depth: 2.8, tags: ['blocked', 'hazardZone'] },
  ],
};
