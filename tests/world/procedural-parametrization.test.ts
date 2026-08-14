import { describe, expect, it } from 'vitest';

import { generateLayoutCandidates } from '../../src/game/world/layout/layoutGenerator';
import type { GeneratedPlanetLayout, Point2, StructuralArchetypeId } from '../../src/game/world/layout/layoutTypes';

// Faz 4 procedural parameterization guard.
//
// The old generator carried five FIXED design templates: an archetype fully determined the spine
// node coordinates, the road corners, the building ring, the rotations and the street-light offsets.
// Two seeds landing on the same archetype produced the same concrete layout. These tests measure the
// opposite property: within one archetype, the concrete geometry must be effectively unique per seed
// while remaining deterministic for a given seed.

const SEED_START = 70_000;
const SEED_COUNT = 40;

const fingerprintOf = (layout: GeneratedPlanetLayout) => {
  const facilities = [...layout.facilities]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((facility) => `${facility.id}@${facility.position.join(',')}#${facility.rotationY.toFixed(3)}`)
    .join('|');
  const roadNodes = [...layout.navigationNodes]
    .filter(({ kind }) => kind === 'spine')
    .map(({ position }) => position.join(','))
    .sort()
    .join('|');
  const roadShape = [...layout.roads]
    .filter(({ role }) => role === 'main-spine')
    .map((road) => road.points.map((point) => point.join(',')).join('>'))
    .sort()
    .join('|');
  const lights = [...layout.streetLights].map(({ position }) => position.join(',')).sort().join('|');
  return { facilities, lights, roadNodes, roadShape, whole: `${facilities}#${roadNodes}#${roadShape}#${lights}` };
};

interface ArchetypeSample {
  readonly facilities: string;
  readonly lights: string;
  readonly roadNodes: string;
  readonly roadShape: string;
  readonly seed: number;
  readonly whole: string;
}

const samples = new Map<StructuralArchetypeId, ArchetypeSample[]>();
let generatedSeeds = 0;
for (let offset = 0; offset < SEED_COUNT; offset += 1) {
  const seed = SEED_START + offset;
  const result = generateLayoutCandidates({ seed });
  if (result.status !== 'success') continue;
  generatedSeeds += 1;
  for (const candidate of result.candidates) {
    const bucket = samples.get(candidate.structure.archetype) ?? [];
    bucket.push({ ...fingerprintOf(candidate), seed });
    samples.set(candidate.structure.archetype, bucket);
  }
}

const repeatRatio = (values: readonly string[]) => values.length === 0 ? 0 : 1 - new Set(values).size / values.length;

describe('Faz 4 procedural parameterization', () => {
  it(`1. ${SEED_COUNT} seed sweep her seedde aday üretir`, () => {
    expect(generatedSeeds).toBe(SEED_COUNT);
    expect(samples.size).toBe(5);
  });

  it('2. aynı arketip farklı seedlerde birebir aynı layout üretmez', () => {
    const report: string[] = [];
    for (const [archetype, bucket] of [...samples.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const ratio = repeatRatio(bucket.map(({ whole }) => whole));
      report.push(`${archetype}: n=${bucket.length} unique=${new Set(bucket.map(({ whole }) => whole)).size} repeat=${(ratio * 100).toFixed(2)}%`);
      expect(ratio).toBe(0);
    }
    console.log(`\n[layout fingerprint repeat rate, seeds ${SEED_START}..${SEED_START + SEED_COUNT - 1}]\n${report.join('\n')}`);
  });

  it('3. facility pozisyon+rotasyon kümesi arketip içinde tekrar etmez', () => {
    for (const [archetype, bucket] of samples) {
      const ratio = repeatRatio(bucket.map(({ facilities }) => facilities));
      expect(`${archetype}:${(ratio * 100).toFixed(2)}`).toBe(`${archetype}:0.00`);
    }
  });

  it('4. yol düğüm kümesi arketip içinde tekrar etmez', () => {
    for (const [archetype, bucket] of samples) {
      const ratio = repeatRatio(bucket.map(({ roadNodes }) => roadNodes));
      expect(`${archetype}:${(ratio * 100).toFixed(2)}`).toBe(`${archetype}:0.00`);
    }
  });

  it('5. sokak lambası kümesi arketip içinde tekrar etmez', () => {
    for (const [archetype, bucket] of samples) {
      const ratio = repeatRatio(bucket.map(({ lights }) => lights));
      expect(`${archetype}:${(ratio * 100).toFixed(2)}`).toBe(`${archetype}:0.00`);
    }
  });

  it('6. main-spine yol geometrisi arketip içinde tekrar etmez', () => {
    for (const [archetype, bucket] of samples) {
      const ratio = repeatRatio(bucket.map(({ roadShape }) => roadShape));
      expect(`${archetype}:${(ratio * 100).toFixed(2)}`).toBe(`${archetype}:0.00`);
    }
  });

  it('7. spine düğüm sayısı arketip içinde sabit değildir', () => {
    for (const [archetype, bucket] of samples) {
      const counts = new Set(bucket.map(({ roadNodes }) => roadNodes.split('|').length));
      expect(`${archetype}:${counts.size > 1}`).toBe(`${archetype}:true`);
    }
  });

  it('8. sokak lambası sayısı arketip içinde sabit değildir', () => {
    for (const [archetype, bucket] of samples) {
      const counts = new Set(bucket.map(({ lights }) => lights.split('|').length));
      expect(`${archetype}:${counts.size > 1}`).toBe(`${archetype}:true`);
    }
  });

  it('9. bina rotasyonları saf yola-bakış değildir', () => {
    const rotations = new Set<string>();
    for (const [, bucket] of samples) for (const sample of bucket) for (const entry of sample.facilities.split('|')) rotations.add(entry.split('#')[1] ?? '');
    expect(rotations.size).toBeGreaterThan(200);
  });

  it('10. determinizm korunur: aynı seed birebir aynı çıktı', () => {
    for (const seed of [SEED_START, SEED_START + 17, SEED_START + 33]) {
      expect(JSON.stringify(generateLayoutCandidates({ seed }))).toBe(JSON.stringify(generateLayoutCandidates({ seed })));
    }
  }, 20_000);

  it('11. arketip içi coğrafi yayılım gerçek: ortalama tepe kayması > 1.5 birim', () => {
    const spread: string[] = [];
    for (const [archetype, bucket] of [...samples.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const habitats = bucket.map(({ facilities }) => {
        const match = /habitat@(-?[\d.]+),(-?[\d.]+)/.exec(facilities);
        return [Number(match?.[1] ?? 0), Number(match?.[2] ?? 0)] as Point2;
      });
      const centroid: Point2 = [habitats.reduce((s, p) => s + p[0], 0) / habitats.length, habitats.reduce((s, p) => s + p[1], 0) / habitats.length];
      const average = habitats.reduce((s, p) => s + Math.hypot(p[0] - centroid[0], p[1] - centroid[1]), 0) / habitats.length;
      spread.push(`${archetype}: habitat mean-offset=${average.toFixed(2)}`);
      expect(average).toBeGreaterThan(1.5);
    }
    console.log(`\n[within-archetype habitat spread]\n${spread.join('\n')}`);
  });
});
