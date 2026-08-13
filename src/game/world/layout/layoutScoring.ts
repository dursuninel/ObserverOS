import { distance, projectedOverlapRatio, projectFacilitiesHeadless } from './layoutMath';
import { LAYOUT_SCORE_WEIGHTS } from './nivalisLayoutIntent';
import type { GeneratedPlanetLayout, LayoutScoreBreakdown, Point2 } from './layoutTypes';

const clamp = (value: number, minimum = 0, maximum = 10) => Math.min(maximum, Math.max(minimum, value));
const facility = (layout: GeneratedPlanetLayout, id: GeneratedPlanetLayout['facilities'][number]['id']) => layout.facilities.find((item) => item.id === id);
const roadLength = (points: readonly Point2[]) => points.slice(1).reduce((sum, point, index) => sum + distance(points[index] ?? point, point), 0);

export function scoreGeneratedLayout(layout: GeneratedPlanetLayout): LayoutScoreBreakdown {
  const habitat = facility(layout, 'habitat');
  const oxygen = facility(layout, 'oxygen');
  const mine = facility(layout, 'mine');
  const reactor = facility(layout, 'reactor');
  const battery = facility(layout, 'battery');
  const solar = facility(layout, 'solar');
  const d = (a: typeof habitat, b: typeof habitat) => a && b ? distance(a.position, b.position) : 99;
  const adjacency = clamp(10 - Math.abs(d(habitat, oxygen) - 7) * 0.8 - Math.abs(d(reactor, battery) - 6) * 0.55);
  const safetySeparation = clamp((d(habitat, mine) - 6) * 1.2 + (d(habitat, reactor) - 5) * 0.9);
  const totalRoad = layout.roads.reduce((sum, road) => sum + roadLength(road.points), 0);
  const turns = layout.roads.reduce((sum, road) => sum + Math.max(0, road.points.length - 2), 0);
  // Calibrated against the procedural generator's actual road distribution (total length p10..p90
  // ~82..112, turns p10..p90 ~17..27). Free allowances sit at the p10 marks so the metric keeps
  // discriminating across the realistic range instead of clamping every candidate to zero.
  const roadQuality = clamp(10 - Math.max(0, totalRoad - 82) * 0.09 - Math.max(0, turns - 14) * 0.22);
  const boundsArea = (layout.cameraBounds.maxX - layout.cameraBounds.minX) * (layout.cameraBounds.maxZ - layout.cameraBounds.minZ);
  // Serbest alan payı jeneratörün gerçek dağılımına göre kalibre edilir. Eski 380/45 değeri
  // Faz 3 sabit yerleşiminin alanına göre seçilmişti; üretilen adaylar 820..1220 aralığında
  // olduğu için metrik HER adayda 0'a kırpılıyor ve seçime hiç katkı vermiyordu — yani
  // jeneratörün derli toplu olma baskısı yoktu. Aralık gerçek dağılıma taşındı.
  const compactness = clamp(10 - Math.max(0, boundsArea - 700) / 40);
  const visualComposition = clamp(10 - Math.abs((habitat?.position[0] ?? 0) - layout.cameraBounds.center[0]) * 0.35 - Math.abs((mine?.position[0] ?? 0) - (solar?.position[0] ?? 0) - 17) * 0.18);
  const expansion = layout.expansionSlots[0];
  const expansionAccess = clamp(expansion ? 10 - Math.abs(expansion.position[0] - (mine?.position[0] ?? 0)) * 0.25 : 0);
  const projected = projectFacilitiesHeadless(layout.facilities);
  let overlap = 0;
  for (let first = 0; first < projected.length; first += 1) for (let second = first + 1; second < projected.length; second += 1) {
    const a = projected[first]; const b = projected[second];
    if (a && b) overlap += projectedOverlapRatio(a, b);
  }
  const screenSpaceOverlap = clamp(10 - overlap * 4);
  const cameraReadability = clamp(8 + screenSpaceOverlap * 0.2);
  const terrainUsage = clamp((mine?.position[0] ?? 0) > 7 ? 10 : 6);
  return { adjacency, cameraReadability, compactness, expansionAccess, roadQuality, safetySeparation, screenSpaceOverlap, terrainUsage, visualComposition };
}

export function totalLayoutScore(breakdown: LayoutScoreBreakdown): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const [criterion, weight] of Object.entries(LAYOUT_SCORE_WEIGHTS)) {
    weighted += breakdown[criterion as keyof LayoutScoreBreakdown] * weight;
    totalWeight += weight;
  }
  return Number((weighted / totalWeight * 10).toFixed(2));
}
