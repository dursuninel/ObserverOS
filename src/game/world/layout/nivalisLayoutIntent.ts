import type { FacilityId } from '../prototype/types';
import type { LayoutScoreBreakdown, LayoutStyle, PlacementProfile, TerrainDefinition } from './layoutTypes';

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

/**
 * Soft scoring ağırlıkları (TUNABLE) — Spec §22.6 kriter listesini sıralar, ağırlık dayatmaz.
 *
 * Eşit ağırlıkta compactness tek başına seçimi çeviremiyordu: aynı seed'in 50 iç adayı arasında
 * facility spanX 21..35 arasında değişmesine rağmen jeneratör dağınık olanları seçebiliyordu.
 * Spec §33.1 "Layout: Compact, açık ve okunabilir" gereği compactness, adjacency ve roadQuality
 * öne çıkarıldı. Toplam puan ağırlıklı ortalama olduğu için 0-100 aralığı korunur.
 */
export const LAYOUT_SCORE_WEIGHTS: Readonly<Record<keyof LayoutScoreBreakdown, number>> = Object.freeze({
  adjacency: 1.8,
  cameraReadability: 0.6,
  compactness: 3,
  expansionAccess: 0.6,
  roadQuality: 1.6,
  safetySeparation: 1,
  screenSpaceOverlap: 0.8,
  terrainUsage: 0.6,
  visualComposition: 1,
});

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

/**
 * Arketip çapalarının dünya koordinatına açılma oranı (TUNABLE).
 *
 * `normalizedToWorld` bu oranı `terrain.bounds` ile çarpar. 0.47 = Faz 4'ün ilk kalibrasyonu;
 * o değerde üretilen adaylar Faz 3 sabit yerleşiminin (Default) yaklaşık iki katı alana
 * yayılıyordu — facility spanX p50 29.1 / spanZ p50 17.2, Default ise 16.0 / 8.1.
 * Spec §33.1 "Layout: Compact, açık ve okunabilir" gereği daraltıldı.
 *
 * DİKKAT: `terrain.bounds` ve `buildable-plateau` bilerek küçültülmedi. Tesis footprint'leri
 * bu oranla küçülmediği için, çapalar yaklaşırken `chooseFacilityAnchor` halka aramasının
 * çakışmaları çözebileceği boş alana ihtiyacı var; plato daraltılırsa üretim komple çöker
 * (ölçülen: plato 0.85 kat → 60/60 seed `structural-generation-failed`).
 * Değiştirdikten sonra `runLayoutSeedSweep` koş, failed === 0 olduğunu doğrula.
 */
export const NIVALIS_ANCHOR_SPREAD = 0.33;

/**
 * Bölge merkezleri çapa yayılımıyla birlikte içeri kayar, GENİŞLİKLERİ kaymaz.
 * Ölçülen tuzak: genişlikler de daraltılınca tesisler kendi operasyonel zone'larının dışında
 * kalıp `structural-generation-failed` veriyor (60/60 seed çöktü). Zone'lar cömert kalmalı;
 * daralan tek şey nereye çekildikleri.
 */
const ZONE_PULL = NIVALIS_ANCHOR_SPREAD / 0.47;
const pull = (value: number) => Number((value * ZONE_PULL).toFixed(2));

export const NIVALIS_TERRAIN: TerrainDefinition = {
  id: 'nivalis-frozen-plateau',
  bounds: { center: [0, 0], width: 44, depth: 30 },
  areas: [
    // Plato ve sınırlar geniş kalır: halka aramasının manevra alanı.
    { id: 'buildable-plateau', center: [0, 0], width: 43, depth: 29, tags: ['buildable'] },
    { id: 'energy-west', center: [pull(-9), pull(1)], width: 18, depth: 24, tags: ['buildable'], operationalZone: 'Energy' },
    { id: 'colony-core', center: [pull(1), pull(-1)], width: 19, depth: 23, tags: ['buildable'], operationalZone: 'Residential' },
    { id: 'life-support-core', center: [pull(5), pull(1)], width: 17, depth: 22, tags: ['buildable'], operationalZone: 'LifeSupport' },
    // Maden yatağı da içeri kayar: eski merkez x=15 endüstriyel ucu doğuda çivileyip koloniyi
    // tek başına yayıyordu. Faz 3 sabit yerleşiminde maden x=7'de duruyor.
    { id: 'mine-deposit', center: [pull(15), pull(-1)], width: 12, depth: 23, tags: ['buildable', 'resourceZone'], operationalZone: 'Industrial' },
    { id: 'expansion-east', center: [pull(18), pull(8)], width: 7, depth: 8, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'expansion-south', center: [pull(-8), pull(-11)], width: 11, depth: 7, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'expansion-north', center: [pull(8), pull(12)], width: 9, depth: 5, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'expansion-west', center: [pull(-18), pull(-8)], width: 7, depth: 8, tags: ['buildable', 'preferredExpansionArea'] },
    { id: 'northwest-ridge', center: [-20, 12.5], width: 2.5, depth: 2.5, tags: ['blocked'] },
    { id: 'southeast-crevasse', center: [20, -12.5], width: 2.4, depth: 2.8, tags: ['blocked', 'hazardZone'] },
  ],
};
