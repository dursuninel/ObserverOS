import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PHASE_THREE_BASELINE_CONFIG } from '../../src/game/simulation/SimulationConfig';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';
import { prototypeAssetRegistry } from '../../src/game/world/assets/prototypeAssetRegistry';
import { createDeterministicRng } from '../../src/game/world/layout/deterministicRng';
import { calculateStructuralDifference, generateLayoutCandidates, generateZoneAnchors, runLayoutSeedSweep } from '../../src/game/world/layout/layoutGenerator';
import { pointInRect, segmentIntersectsRect } from '../../src/game/world/layout/layoutMath';
import { isNavigationConnected, validateGeneratedLayout } from '../../src/game/world/layout/layoutValidation';
import { NIVALIS_LAYOUT_INTENT, NIVALIS_TERRAIN } from '../../src/game/world/layout/nivalisLayoutIntent';
import type { GeneratedPlanetLayout, StructuralArchetypeId } from '../../src/game/world/layout/layoutTypes';
import { getVisualCompound } from '../../src/game/world/layout/visualCompoundProfiles';

const generated = generateLayoutCandidates({ seed: 41_001 });
if (generated.status === 'failure') throw new Error(`Structural reference generation failed: ${generated.reasons.join(', ')}`);
const candidates = generated.candidates;
const byArchetype = (id: StructuralArchetypeId) => {
  const candidate = candidates.find((item) => item.structure.archetype === id);
  if (!candidate) throw new Error(`Missing structural archetype ${id}.`);
  return candidate;
};
const clone = (layout: GeneratedPlanetLayout): GeneratedPlanetLayout => structuredClone(layout);
const mainTopology = (layout: GeneratedPlanetLayout) => layout.navigationEdges.filter(({ role }) => role === 'main-spine').map(({ from, to }) => `${from}>${to}`).sort();

describe('Faz 4 Test 2 structural layout generation', () => {
  it('1. Top 5 yalnız fixed-base jitter değildir', () => {
    expect(new Set(candidates.map(({ structure }) => structure.archetype)).size).toBeGreaterThanOrEqual(3);
    const habitatPositions = candidates.map((layout) => layout.facilities.find(({ id }) => id === 'habitat')!.position);
    expect(Math.max(...habitatPositions.map((position) => Math.hypot(position[0] - habitatPositions[0]![0], position[1] - habitatPositions[0]![1])))).toBeGreaterThan(3);
  });

  it('2. STYLE_BASE_POSITIONS production candidate source değildir', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/game/world/layout/layoutGenerator.ts'), 'utf8');
    expect(source).not.toContain('STYLE_BASE_POSITIONS');
    expect(source).not.toContain('createCandidatePositions');
  });

  it('3. zone sampling gerçek anchor diversity üretir', () => {
    const zone = NIVALIS_TERRAIN.areas.find(({ id }) => id === 'colony-core')!;
    const anchors = generateZoneAnchors(zone, { width: 6, depth: 6 }, createDeterministicRng(17));
    expect(anchors).toHaveLength(20);
    expect(new Set(anchors.map((anchor) => anchor.join(':'))).size).toBe(20);
    anchors.forEach((anchor) => expect(pointInRect(anchor, zone)).toBe(true));
  });

  it('4. normal NIVALIS seed en az üç structural signature üretir', () => expect(new Set(candidates.map(({ structure }) => structure.signature)).size).toBeGreaterThanOrEqual(3));

  it('5. benzer layoutlar visual top listte deduplicate edilir', () => {
    expect(new Set(candidates.map(({ structure }) => structure.signature)).size).toBe(candidates.length);
    for (let first = 0; first < candidates.length; first += 1) for (let second = first + 1; second < candidates.length; second += 1) {
      expect(calculateStructuralDifference(candidates[first]!, candidates[second]!)).toBeGreaterThanOrEqual(0.32);
    }
  });

  it('6. road topology adaylar arasında değişir', () => expect(new Set(candidates.map((layout) => JSON.stringify(mainTopology(layout)))).size).toBeGreaterThanOrEqual(3));
  it('7. L topology kontrollü corner taşır', () => expect(byArchetype('l-shaped').roads.some(({ role, points }) => role === 'main-spine' && points.length > 2)).toBe(true));
  it('8. T topology üç spatial branch taşır', () => {
    const layout = byArchetype('t-junction');
    const degrees = new Map<string, number>();
    layout.navigationEdges.filter(({ role }) => role === 'main-spine').forEach(({ from, to }) => { degrees.set(from, (degrees.get(from) ?? 0) + 1); degrees.set(to, (degrees.get(to) ?? 0) + 1); });
    expect(Math.max(...degrees.values())).toBeGreaterThanOrEqual(3);
  });
  it('9. offset hub batı expansion kolunu bağımsız bağlar', () => expect(mainTopology(byArchetype('offset-hub'))).toContain('spine-expansion>spine-solar'));
  it('10. split core expansionı Habitat çekirdeğinden dallandırır', () => expect(mainTopology(byArchetype('split-core'))).toContain('spine-habitat>spine-expansion'));
  it('11. main spine z=0 hard-coded değildir', () => candidates.forEach((layout) => expect(new Set(layout.navigationNodes.filter(({ kind }) => kind === 'spine').map(({ position }) => position[1])).size).toBeGreaterThan(1)));

  it('12. Habitat visualVariant compound compositionı değiştirir', () => expect(new Set(candidates.map((layout) => layout.facilities.find(({ id }) => id === 'habitat')!.visualVariantId)).size).toBeGreaterThanOrEqual(3));
  it('13. Habitat visual module count adaylar arasında değişir', () => expect(new Set(candidates.map((layout) => layout.facilities.find(({ id }) => id === 'habitat')!.visualModules.length)).size).toBeGreaterThan(1));
  it('14. visual modules gameplay facility instance değildir', () => candidates.forEach((layout) => { expect(layout.facilities).toHaveLength(6); expect(layout.structure.visualModuleCount).toBeGreaterThan(layout.facilities.length); }));
  it('15. Simulation canonical facility count görmeye devam eder', () => {
    const engine = new SimulationEngine({ config: PHASE_THREE_BASELINE_CONFIG });
    expect(engine.getSnapshot().facilities).toHaveLength(6);
    candidates.forEach((layout) => expect(layout.facilities).toHaveLength(NIVALIS_LAYOUT_INTENT.requiredFacilities.length));
  });

  it('16. Solar visual composition variantları kayıtlı assetlerden oluşur', () => {
    const variants = Array.from({ length: 30 }, (_, index) => getVisualCompound('solar', 'compact-pod', createDeterministicRng(index + 1)));
    expect(new Set(variants.map(({ id }) => id)).size).toBe(3);
    variants.flatMap(({ modules }) => modules).forEach(({ assetId }) => expect(prototypeAssetRegistry.get(assetId)).toBeDefined());
  });

  it('17. visual compound overlap hard validation tarafından yakalanır', () => {
    const invalid = clone(candidates[0]!);
    const [first, second] = invalid.facilities;
    Object.assign(second!.visualFootprint, { center: first!.visualFootprint.center });
    expect(validateGeneratedLayout(invalid, NIVALIS_TERRAIN).reasons.some((reason) => reason.startsWith('facility-overlap'))).toBe(true);
  });

  it('18. compound screen-space validation primary core yerine visual footprinti görür', () => {
    const invalid = clone(candidates[0]!);
    const first = invalid.facilities[0]!;
    const second = invalid.facilities[1]!;
    Object.assign(second, { position: first.position, visualFootprint: { ...second.visualFootprint, center: first.position, width: first.visualFootprint.width, depth: first.visualFootprint.depth } });
    expect(validateGeneratedLayout(invalid, NIVALIS_TERRAIN).reasons.some((reason) => reason.startsWith('screen-obscured'))).toBe(true);
  });

  it('19. Expansion birden fazla allowed spatial relationda üretilebilir', () => expect(new Set(candidates.map(({ structure }) => structure.expansionRelation)).size).toBeGreaterThanOrEqual(3));
  it('20. Street-light pattern candidate road graphından türetilir', () => candidates.forEach((layout) => layout.streetLights.forEach((light) => { if (light.roadNodeId) expect(layout.navigationNodes.some(({ id }) => id === light.roadNodeId)).toBe(true); else expect(layout.roads.some((road) => road.points.slice(1, -1).some((point) => Math.hypot(point[0] + 0.55 - light.position[0], point[1] + 0.55 - light.position[1]) < 0.01))).toBe(true); })));
  it('21. farklı structural aday farklı light positions üretir', () => expect(new Set(candidates.map((layout) => JSON.stringify(layout.streetLights.map(({ position }) => position)))).size).toBe(candidates.length));
  it('22. terrain visual footprint variant deterministic ve çeşitli kalır', () => {
    expect(generateLayoutCandidates({ seed: 41_001 })).toEqual(generated);
    expect(new Set(candidates.map(({ structure }) => structure.terrainVariant)).size).toBeGreaterThanOrEqual(3);
    candidates.forEach((layout) => expect(layout.plateauVertices.length).toBeGreaterThanOrEqual(7));
  });
  it('23. aynı seed aynı structural outputu üretir', () => expect(generateLayoutCandidates({ seed: 41_001 })).toEqual(generateLayoutCandidates({ seed: 41_001 })));
  it('24. yeni seed structural selections veya anchorları değiştirebilir', () => {
    const other = generateLayoutCandidates({ seed: 41_002 });
    expect(other.status).toBe('success');
    if (other.status === 'success') expect(other.candidates.map((layout) => ({ signature: layout.structure.signature, positions: layout.facilities.map(({ position }) => position) }))).not.toEqual(candidates.map((layout) => ({ signature: layout.structure.signature, positions: layout.facilities.map(({ position }) => position) })));
  });
  it('25. 100-seed sweep her seedde en az üç structural signature doğrular', () => expect(runLayoutSeedSweep(100)).toMatchObject({ testedSeeds: 100, valid: 100, failed: 0, minimumStructuralSignatures: 3 }));
  it('26. mevcut road/nav connectivity korunur ve yollar compoundlardan geçmez', () => candidates.forEach((layout) => {
    expect(isNavigationConnected(layout)).toBe(true);
    expect(validateGeneratedLayout(layout, NIVALIS_TERRAIN).valid).toBe(true);
    layout.roads.forEach((road) => road.points.slice(1).forEach((end, index) => layout.facilities.forEach((facility) => {
      const targetId = layout.navigationEdges.find(({ id }) => id === road.edgeId)?.to.replace(/-(approach|entrance)$/, '');
      if (road.role !== 'main-spine' && facility.id === targetId) return;
      expect(segmentIntersectsRect(road.points[index] ?? end, end, facility.visualFootprint, 0.15)).toBe(false);
    })));
  }));
  it('27. layout generation workforce/maintenance authoritative determinismı etkilemez', () => {
    const first = new SimulationEngine({ config: PHASE_THREE_BASELINE_CONFIG });
    const second = new SimulationEngine({ config: PHASE_THREE_BASELINE_CONFIG });
    first.advanceFixedSteps(40);
    generateLayoutCandidates({ seed: 999 });
    first.advanceFixedSteps(40);
    second.advanceFixedSteps(80);
    expect(first.serializeAuthoritativeState()).toBe(second.serializeAuthoritativeState());
    expect(first.getSnapshot().workforce.population).toBe(11);
  });
});
