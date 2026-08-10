import type { FacilityId } from '../prototype/types';
import type { LayoutStyle, PlacementProfile, Point2, TerrainDefinition } from './layoutTypes';

export const GENERATOR_VERSION = '4.1.0';
export const INTERNAL_CANDIDATE_COUNT = 30;
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
  bounds: { center: [1, 0], width: 32, depth: 20 },
  areas: [
    { id: 'buildable-plateau', center: [1, 0], width: 31, depth: 19, tags: ['buildable'] },
    { id: 'energy-west', center: [-5, 0], width: 11, depth: 17, tags: ['buildable'], operationalZone: 'Energy' },
    { id: 'colony-core', center: [3, 0], width: 10, depth: 16, tags: ['buildable'], operationalZone: 'Residential' },
    { id: 'life-support-core', center: [4, 2], width: 10, depth: 10, tags: ['buildable'], operationalZone: 'LifeSupport' },
    { id: 'mine-deposit', center: [10, -3], width: 8, depth: 11, tags: ['buildable', 'resourceZone'], operationalZone: 'Industrial' },
    { id: 'expansion-periphery', center: [11, 4], width: 8, depth: 9, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'northwest-ridge', center: [-13.8, 7.8], width: 2.2, depth: 2.2, tags: ['blocked'] },
    { id: 'southeast-crevasse', center: [15, -7.8], width: 2, depth: 2.4, tags: ['blocked', 'hazardZone'] },
  ],
};

export const STYLE_BASE_POSITIONS: Readonly<Record<LayoutStyle, Readonly<Record<FacilityId | 'expansion', Point2>>>> = Object.freeze({
  Compact: { solar: [-8, 4.2], reactor: [-5, -4.4], battery: [-2, 4.2], habitat: [2, -4.4], oxygen: [5, 4.2], mine: [9, -4.4], expansion: [11, 4.4] },
  Linear: { solar: [-10, 3.8], reactor: [-6.5, -3.8], battery: [-3, 3.8], habitat: [1, -3.8], oxygen: [5, 3.8], mine: [9, -3.8], expansion: [12, 3.8] },
  Distributed: { solar: [-10, 5.7], reactor: [-7, -5.8], battery: [-2.5, 5.5], habitat: [2, -5.6], oxygen: [6, 5.5], mine: [11, -5.6], expansion: [12.5, 5.5] },
});
