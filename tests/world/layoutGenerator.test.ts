import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createDeterministicRng } from '../../src/game/world/layout/deterministicRng';
import { generatedPlanetLayoutSchema } from '../../src/game/world/layout/generatedLayoutSchema';
import { generateLayoutCandidates, runLayoutSeedSweep } from '../../src/game/world/layout/layoutGenerator';
import { distance, pointInRect, projectedOverlapRatio, projectFacilitiesHeadless, rectanglesOverlap } from '../../src/game/world/layout/layoutMath';
import { generatedLayoutToTravelNetwork, getGeneratedRoadNeighbors } from '../../src/game/world/layout/layoutQueries';
import { scoreGeneratedLayout } from '../../src/game/world/layout/layoutScoring';
import { isNavigationConnected, parseFrozenLayout, validateGeneratedLayout } from '../../src/game/world/layout/layoutValidation';
import { NIVALIS_LAYOUT_INTENT, NIVALIS_PLACEMENT_PROFILES, NIVALIS_TERRAIN } from '../../src/game/world/layout/nivalisLayoutIntent';
import { findTerrainPath } from '../../src/game/world/layout/terrainPathfinding';
import type { GeneratedPlanetLayout, TerrainDefinition } from '../../src/game/world/layout/layoutTypes';

const result = generateLayoutCandidates({ seed: 41_001 });
if (result.status === 'failure') throw new Error(`Reference generation failed: ${result.reasons.join(', ')}`);
const layout = result.candidates[0];
if (!layout) throw new Error('Reference generation returned no candidate.');
const copy = (): GeneratedPlanetLayout => structuredClone(layout);
const facility = (source: GeneratedPlanetLayout, id: GeneratedPlanetLayout['facilities'][number]['id']) => source.facilities.find((item) => item.id === id);

describe('Faz 4 deterministic layout generator', () => {
  it('1. aynı seed aynı layout üretir', () => {
    const outputs = Array.from({ length: 10 }, () => generateLayoutCandidates({ seed: 41_001 }));
    expect(outputs.every((output) => JSON.stringify(output) === JSON.stringify(outputs[0]))).toBe(true);
  });

  it('2. farklı seed geçerli ve farklı layout üretebilir', () => {
    const other = generateLayoutCandidates({ seed: 41_002 });
    expect(other.status).toBe('success');
    if (other.status === 'success') expect(other.candidates[0]?.facilities).not.toEqual(layout.facilities);
  });

  it('3. bütün required facilityleri üretir', () => expect(new Set(layout.facilities.map(({ id }) => id))).toEqual(new Set(NIVALIS_LAYOUT_INTENT.requiredFacilities)));

  it('4. facility overlap üretmez', () => {
    for (let first = 0; first < layout.facilities.length; first += 1) for (let second = first + 1; second < layout.facilities.length; second += 1) {
      const a = layout.facilities[first]; const b = layout.facilities[second];
      if (a && b) expect(rectanglesOverlap(a.footprint, b.footprint, 0.55)).toBe(false);
    }
  });

  it('5. footprintleri buildable alan içinde tutar', () => expect(validateGeneratedLayout(layout, NIVALIS_TERRAIN).reasons.some((reason) => reason.startsWith('outside-buildable'))).toBe(false));

  it('6. required terrain tagini uygular', () => expect(pointInRect(facility(layout, 'mine')?.position ?? [0, 0], NIVALIS_TERRAIN.areas.find(({ tags }) => tags.includes('resourceZone'))!)).toBe(true));

  it('7. forbidden terrain ihlalini reject eder', () => {
    const invalid = copy();
    const reactor = invalid.facilities.find(({ id }) => id === 'reactor')!;
    const hazard = NIVALIS_TERRAIN.areas.find(({ tags }) => tags.includes('hazardZone'))!;
    Object.assign(reactor, { position: hazard.center, footprint: { ...reactor.footprint, center: hazard.center }, visualFootprint: { ...reactor.visualFootprint, center: hazard.center } });
    expect(validateGeneratedLayout(invalid, NIVALIS_TERRAIN).reasons).toContain('forbidden-terrain:reactor');
  });

  it('8. minimum separation hard validation uygular', () => {
    const invalid = copy();
    const oxygen = invalid.facilities.find(({ id }) => id === 'oxygen')!;
    const habitat = invalid.facilities.find(({ id }) => id === 'habitat')!;
    Object.assign(oxygen.visualFootprint, { center: habitat.position });
    expect(validateGeneratedLayout(invalid, NIVALIS_TERRAIN).reasons.some((reason) => reason.startsWith('facility-overlap'))).toBe(true);
  });

  it('9. entrance node gerçek AssetRegistry entrance noktasına ulaşır', () => layout.facilities.forEach((item) => expect(layout.navigationNodes.find(({ id }) => id === `${item.id}-entrance`)?.position).toEqual(item.entrance)));

  it('10. work ve service clearance taşır', () => layout.facilities.forEach((item) => { expect(item.serviceClearance).toBeGreaterThan(0); expect(item.workPoint).toHaveLength(2); }));

  it('11. Habitat/Oxygen yakınlığı scoring contract içinde değerlendirilir', () => expect(NIVALIS_PLACEMENT_PROFILES.habitat.preferredNeighbours).toContainEqual({ facilityId: 'oxygen', maxDistance: 9, weight: 1 }));

  it('12. Habitat/Mine ayrımı korunur', () => expect(distance(facility(layout, 'habitat')!.position, facility(layout, 'mine')!.position)).toBeGreaterThan(7));

  it('13. Reactor/Habitat aşırı yakınlığı safety score düşürür', () => {
    const unsafe = copy(); const reactor = unsafe.facilities.find(({ id }) => id === 'reactor')!; Object.assign(reactor, { position: facility(unsafe, 'habitat')!.position });
    expect(scoreGeneratedLayout(unsafe).safetySeparation).toBeLessThan(layout.scoreBreakdown.safetySeparation);
  });

  it('14. Battery/Reactor preference adjacency içinde değerlendirilir', () => expect(NIVALIS_PLACEMENT_PROFILES.battery.preferredNeighbours.some(({ facilityId }) => facilityId === 'reactor')).toBe(true));
  it('15. Mine outer resource zone içinde kalır', () => expect(facility(layout, 'mine')!.position[0]).toBeGreaterThan(7));
  it('16. Solar açık buildable alanda ve hazard dışında kalır', () => expect(validateGeneratedLayout(layout, NIVALIS_TERRAIN).reasons).not.toContain('forbidden-terrain:solar'));

  for (const [index, style] of (['Compact', 'Linear', 'Distributed'] as const).entries()) {
    it(`${17 + index}. ${style} profil valid aday üretir`, () => expect(generateLayoutCandidates({ seed: 12, style }).status).toBe('success'));
  }

  it('20. screen-space overlap pure projection ile tespit edilir', () => {
    const projected = projectFacilitiesHeadless(layout.facilities);
    expect(projectedOverlapRatio(projected[0]!, { ...projected[1]!, center: projected[0]!.center })).toBeGreaterThan(0.8);
  });

  it('21. tamamen obscured mandatory facility reject edilir', () => {
    const invalid = copy(); const first = invalid.facilities[0]!; const second = invalid.facilities[1]!;
    Object.assign(second, { position: first.position, footprint: { ...second.footprint, center: first.position } });
    expect(validateGeneratedLayout(invalid, NIVALIS_TERRAIN).reasons.some((reason) => reason.startsWith('screen-obscured'))).toBe(true);
  });

  it('22. road graph connected', () => layout.navigationNodes.forEach((node) => expect(getGeneratedRoadNeighbors(layout, node.id).length).toBeGreaterThan(0)));
  it('23. navigation graph connected', () => expect(isNavigationConnected(layout)).toBe(true));
  it('24. A* deterministic', () => expect(findTerrainPath({ start: [-5, 0], goal: [5, 0], terrain: NIVALIS_TERRAIN })).toEqual(findTerrainPath({ start: [-5, 0], goal: [5, 0], terrain: NIVALIS_TERRAIN })));
  it('25. A* blocked terraini aşmaz', () => {
    const path = findTerrainPath({ start: [-14, 6], goal: [-12, 8], terrain: NIVALIS_TERRAIN });
    const blocked = NIVALIS_TERRAIN.areas.filter(({ tags }) => tags.includes('blocked'));
    path?.slice(1, -1).forEach((pathPoint) => blocked.forEach((area) => expect(pointInRect(pathPoint, area, -0.2)).toBe(false)));
  });
  it('26. service road diğer facility footprintlerine girmez', () => layout.roads.forEach((road) => road.points.slice(1, -1).forEach((roadPoint) => layout.facilities.forEach((item) => expect(pointInRect(roadPoint, item.footprint)).toBe(false)))));
  it('27. road facility center yerine entrancea ulaşır', () => layout.facilities.forEach((item) => expect(layout.roads.find(({ edgeId }) => edgeId === `${item.id}-entrance-link`)?.points.at(-1)).toEqual(item.entrance)));
  it('28. main spine quality pozitif score taşır', () => expect(layout.scoreBreakdown.roadQuality).toBeGreaterThan(0));
  it('29. gereksiz road zig-zag scoreu düşürür', () => { const zigzag = copy(); const road = zigzag.roads[0]!; Object.assign(road, { points: [road.points[0]!, [0, 7], [1, -7], road.points.at(-1)!] }); expect(scoreGeneratedLayout(zigzag).roadQuality).toBeLessThan(layout.scoreBreakdown.roadQuality); });
  it('30. expansion slot valid', () => expect(layout.expansionSlots).toHaveLength(1));
  it('31. expansion footprint capacity intended footprinti alır', () => expect(layout.expansionSlots[0]!.footprintCapacity).toEqual({ width: 5, depth: 5 }));
  it('32. junction street light placement üretir', () => expect(layout.streetLights.some(({ reason }) => reason === 'junction')).toBe(true));
  it('33. approach street light placement üretir', () => expect(layout.streetLights.some(({ reason }) => reason === 'approach')).toBe(true));
  it('34. uzun segment ara light anchor üretebilir', () => { const distributed = generateLayoutCandidates({ seed: 3, style: 'Distributed' }); expect(distributed.status === 'success' && distributed.candidates.some((item) => item.streetLights.some(({ reason }) => reason === 'intermediate'))).toBe(true); });
  it('35. street-light duplicate/spam yapmaz', () => expect(new Set(layout.streetLights.map(({ position }) => position.join(':'))).size).toBe(layout.streetLights.length));
  it('36. JSON round-trip semantic equality sağlar', () => expect(JSON.parse(JSON.stringify(layout)) as unknown).toEqual(layout));
  it('37. Zod generated layoutu doğrular', () => expect(generatedPlanetLayoutSchema.safeParse(layout).success).toBe(true));
  it('38. invalid frozen layout fail-fast olur', () => expect(() => parseFrozenLayout({ ...layout, facilities: [] })).toThrow());
  it('39. impossible terrain bounded structured failure döner', () => {
    const impossible: TerrainDefinition = { id: 'impossible', bounds: { center: [0, 0], width: 3, depth: 3 }, areas: [{ id: 'tiny', center: [0, 0], width: 2, depth: 2, tags: ['buildable'] }] };
    const failed = generateLayoutCandidates({ seed: 1, terrain: impossible, internalCandidateCount: 4 });
    expect(failed).toMatchObject({ status: 'failure', attemptedCandidates: 4 });
  });
  it('40. 100 seed sweep bütün seedlerde valid top candidate bulur', () => expect(runLayoutSeedSweep(100)).toMatchObject({ testedSeeds: 100, valid: 100, failed: 0 }));
  it('41. renderer generated layout placement tüketir', () => { const source = readFileSync(resolve(process.cwd(), 'src/game/world/renderer/WorldScene.tsx'), 'utf8'); expect(source).toContain('getGeneratedFacility(layout, id)'); expect(source).not.toContain('getFacilityPlacement(id)'); });
  it('42. renderer facility placement seçmez', () => { const source = readFileSync(resolve(process.cwd(), 'src/game/world/renderer/WorldScene.tsx'), 'utf8'); expect(source).not.toContain('Math.random'); expect(source).not.toContain('generateLayoutCandidates'); });
  it('43. generated navigation TravelNetworkConfig olarak authoritative engine sınırına aktarılır', () => { const network = generatedLayoutToTravelNetwork(layout, 0.25); expect(network.nodes).toHaveLength(layout.navigationNodes.length); expect(network.edges).toEqual(layout.navigationEdges.map(({ from, to }) => ({ from, to }))); });
  it('44. candidate order explicit score ve id tie-break ile deterministic', () => expect(result.candidates.map(({ score }) => score)).toEqual([...result.candidates.map(({ score }) => score)].sort((a, b) => b - a)));
  it('45. RNG doğrudan Math.random kullanmadan tekrar üretilebilir', () => { const a = createDeterministicRng(7); const b = createDeterministicRng(7); expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next())); });
});
