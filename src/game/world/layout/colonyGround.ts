import type { CameraBounds, GeneratedPlanetLayout, Point2, PropZone, Rect2 } from './layoutTypes';

/**
 * Koloni zemini içerikten TÜRETİLMEZ; sabit bir karedir.
 *
 * Eski `derivePlateauVertices` zemini `cameraBounds`'tan türetip her tepe noktasına radyal/açısal
 * jitter uyguluyordu. `radialJitter < 1` düşen köşelerde poligon içeri çöküyor, `deriveCameraBounds`
 * payını (3.4) yiyip bitiriyordu; sonuç: bina/yol/kaya zeminin dışında havada kalıyordu ve doğrulama
 * bunu hiç yakalamıyordu (yalnız `buildable-plateau` DİKDÖRTGENİ kontrol ediliyordu).
 *
 * Yarı-kenar 22 → 18 (44x44 → 36x36): 22'de koloni karenin ortasında küçük kalıyordu. Kareyi
 * küçültmek TEK BAŞINA yetmez, çünkü içerik 20.034'e kadar uzanıyordu; içeriğin yayılımı
 * `COLONY_BUILDABLE_HALF_EXTENT` ile birlikte daraltıldı.
 */
export const COLONY_GROUND_HALF_EXTENT = 18;

/**
 * İçeriğin (tesis bileşkeleri) sığmak zorunda olduğu iç kare — `buildable-plateau` alanı bu
 * değerden türetilir, `chooseFacilityAnchor` her footprint'i buna karşı kırpar.
 *
 * ÖLÇÜLDÜ (80 seed x 5 aday): bu kırpma yarı-kenarı p ise içeriğin ulaştığı en dış nokta ≈ p + 0.56
 * çıkıyor — fark, platoya karşı kırpılmayan yol noktaları, sokak lambaları ve genişleme padinden
 * geliyor. p = 16.3 → ölçülen maksimum 16.861, kaya kuşağının iç kenarı 17.0.
 *
 * DİKKAT: bu değeri düşürmek ucuz DEĞİL — çeşitliliği yiyor. Ölçülen (seed 1..100, aday=3):
 * 16.6 → 100/100 · 16.3 → 100/100 · 16.1 → 99/100 · 15.7 → 99/100 ve seed 41001 artık hiç
 * `split-core` adayı üretmiyor. Sebep: bileşkeler bu oranla küçülmediği için daralan tek şey
 * `chooseFacilityAnchor`'ın manevra alanı; en geniş yayılan arketipler önce eleniyor.
 * Değiştirdikten sonra `runLayoutSeedSweep(100)` koş, failed === 0 olduğunu doğrula.
 */
export const COLONY_BUILDABLE_HALF_EXTENT = 16.3;

/** Kameranın çerçevelediği sabit dikdörtgen: aday/mod fark etmez, bu yüzden kadraj zıplamaz. */
export const COLONY_GROUND_CAMERA_BOUNDS: CameraBounds = Object.freeze({
  center: [0, 0] as Point2,
  maxX: COLONY_GROUND_HALF_EXTENT,
  maxZ: COLONY_GROUND_HALF_EXTENT,
  minX: -COLONY_GROUND_HALF_EXTENT,
  minZ: -COLONY_GROUND_HALF_EXTENT,
});

/** Zemin karesinin köşeleri — saat yönünün tersinde, merkezi origin. HER aday bunu birebir kullanır. */
export const COLONY_GROUND_VERTICES: readonly Point2[] = Object.freeze([
  [-COLONY_GROUND_HALF_EXTENT, -COLONY_GROUND_HALF_EXTENT],
  [COLONY_GROUND_HALF_EXTENT, -COLONY_GROUND_HALF_EXTENT],
  [COLONY_GROUND_HALF_EXTENT, COLONY_GROUND_HALF_EXTENT],
  [-COLONY_GROUND_HALF_EXTENT, COLONY_GROUND_HALF_EXTENT],
] as const);

export const COLONY_GROUND_RECT: Rect2 = Object.freeze({
  center: [0, 0] as Point2,
  depth: COLONY_GROUND_HALF_EXTENT * 2,
  width: COLONY_GROUND_HALF_EXTENT * 2,
});

/**
 * Kenar süsü kaya kuşağı: içerik en fazla 16.861'e ulaştığı için kuşak 17.0'da başlar
 * (merkez 17.45 ∓ kalınlık/2), dış kenarı 17.9 ile zeminin 18'inin içinde kalır.
 */
export const COLONY_GROUND_PROP_BAND_CENTER = 17.45;
export const COLONY_GROUND_PROP_BAND_THICKNESS = 0.9;
const PROP_ZONES_PER_EDGE = 6;
const PROP_ZONE_LENGTH = 5;
const PROP_ZONE_SPAN = 14.3;

const EPSILON = 1e-9;

export function isInsideColonyGround([x, z]: Point2, margin = 0): boolean {
  const limit = COLONY_GROUND_HALF_EXTENT - margin + EPSILON;
  return Math.abs(x) <= limit && Math.abs(z) <= limit;
}

/**
 * Görsel modüller sahnede tesisin DÖNDÜRÜLMÜŞ grubunun çocuğudur (`WorldScene`:
 * `<group rotation={[0, rotationY, 0]}>` içinde `position={module.localPosition}`), yani dünya
 * konumları döndürülerek bulunur. Bunu atlayıp `position + localPosition` demek yanlış noktayı
 * kontrol ettiriyordu: hem bileşkenin AABB'sinin dışında hayalî taşmalar üretiyor hem de gerçek
 * taşmaları kaçırıyordu. three.js'in Y dönüşüyle birebir aynı formül (bkz. `transformLocalPoint`).
 */
export function moduleWorldPoint(position: Point2, localPosition: Point2, rotationY: number): Point2 {
  const cosine = Math.cos(rotationY);
  const sine = Math.sin(rotationY);
  return [position[0] + localPosition[0] * cosine + localPosition[1] * sine, position[1] - localPosition[0] * sine + localPosition[1] * cosine];
}

export function rectCorners(rect: Rect2): readonly Point2[] {
  const [x, z] = rect.center;
  const halfWidth = rect.width / 2;
  const halfDepth = rect.depth / 2;
  return [[x - halfWidth, z - halfDepth], [x + halfWidth, z - halfDepth], [x + halfWidth, z + halfDepth], [x - halfWidth, z + halfDepth]];
}

export interface GroundOccupancyPoint {
  readonly category: 'expansion' | 'facility' | 'navigation' | 'prop' | 'road' | 'street-light';
  readonly ownerId: string;
  readonly point: Point2;
}

/**
 * Zeminin üstünde görünen HER şeyin dünya noktaları. Doğrulama ve testler aynı listeyi kullanır ki
 * "ekranda görünen ama kontrol edilmeyen" bir kategori kalmasın.
 */
export function colonyGroundOccupancyPoints(layout: GeneratedPlanetLayout): readonly GroundOccupancyPoint[] {
  const points: GroundOccupancyPoint[] = [];
  const push = (category: GroundOccupancyPoint['category'], ownerId: string, list: readonly Point2[]) => {
    for (const point of list) points.push({ category, ownerId, point });
  };
  for (const facility of layout.facilities) {
    push('facility', facility.id, rectCorners(facility.footprint));
    push('facility', facility.id, rectCorners(facility.visualFootprint));
    push('facility', facility.id, [facility.position, facility.entrance, facility.workPoint]);
    push('facility', facility.id, facility.visualModules.map((module) => moduleWorldPoint(facility.position, module.localPosition, facility.rotationY)));
  }
  for (const road of layout.roads) push('road', road.edgeId, road.points);
  for (const node of layout.navigationNodes) push('navigation', node.id, [node.position]);
  for (const light of layout.streetLights) push('street-light', light.id, [light.position]);
  for (const slot of layout.expansionSlots) {
    push('expansion', slot.id, [slot.position]);
    push('expansion', slot.id, rectCorners({ center: slot.position, ...slot.footprintCapacity }));
  }
  for (const zone of layout.propZones) {
    push('prop', zone.id, rectCorners(zone));
    push('prop', zone.id, [zone.center]);
  }
  return points;
}

/** Kare dışına taşan her şey için `outside-ground:<kategori>:<id>` gerekçesi üretir. */
export function colonyGroundViolations(layout: GeneratedPlanetLayout): readonly string[] {
  const reasons = new Set<string>();
  for (const { category, ownerId, point } of colonyGroundOccupancyPoints(layout)) {
    if (!isInsideColonyGround(point)) reasons.add(`outside-ground:${category}:${ownerId}`);
  }
  return [...reasons];
}

/**
 * Kenar süsü kaya kuşağı: karenin dört kenarı boyunca, içeriğin ulaşabildiği en uzak noktanın
 * (20.034) dışında kalan bantta duran prop bölgeleri. Renderer her bölgeye 2 kaya koyar
 * (bkz. `getGeneratedPropPlacements`), yani kenar başına 12, toplam 48 kaya.
 *
 * Jitter deterministiktir: aday indeksi + kenar + sıra. RNG akışı tüketilmez, böylece zemin
 * süslemesi jeneratörün geri kalanının determinizmini kaydırmaz.
 */
export function colonyGroundPropZones(candidateIndex: number, seedOffset: number): readonly PropZone[] {
  const edges = ['north', 'east', 'south', 'west'] as const;
  const zones: PropZone[] = [];
  edges.forEach((edge, edgeIndex) => {
    for (let index = 0; index < PROP_ZONES_PER_EDGE; index += 1) {
      const ratio = index / (PROP_ZONES_PER_EDGE - 1) * 2 - 1;
      const jitterStep = (seedOffset + candidateIndex * 3 + edgeIndex * 7 + index * 5) % 5 - 2;
      const along = ratio * PROP_ZONE_SPAN + jitterStep * 0.35;
      const band = edge === 'north' || edge === 'east' ? COLONY_GROUND_PROP_BAND_CENTER : -COLONY_GROUND_PROP_BAND_CENTER;
      const horizontal = edge === 'north' || edge === 'south';
      zones.push({
        center: horizontal ? [Number(along.toFixed(3)), band] : [band, Number(along.toFixed(3))],
        density: 'low',
        depth: horizontal ? COLONY_GROUND_PROP_BAND_THICKNESS : PROP_ZONE_LENGTH,
        id: `ground-rocks-${edge}-${index}`,
        seedOffset: (seedOffset + edgeIndex * 3 + index) % 97,
        width: horizontal ? PROP_ZONE_LENGTH : COLONY_GROUND_PROP_BAND_THICKNESS,
      });
    }
  });
  return zones;
}
