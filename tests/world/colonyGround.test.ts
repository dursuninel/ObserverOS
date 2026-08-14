import { describe, expect, it } from 'vitest';

import {
  COLONY_BUILDABLE_HALF_EXTENT,
  COLONY_GROUND_HALF_EXTENT,
  COLONY_GROUND_PROP_BAND_CENTER,
  COLONY_GROUND_PROP_BAND_THICKNESS,
  COLONY_GROUND_VERTICES,
  colonyGroundOccupancyPoints,
  isInsideColonyGround,
  moduleWorldPoint,
  rectCorners,
} from '../../src/game/world/layout/colonyGround';
import { generateLayoutCandidates } from '../../src/game/world/layout/layoutGenerator';
import {
  getGeneratedExpansionPads,
  getGeneratedPlateauVertices,
  getGeneratedPropPlacements,
  getGeneratedRoadTilePlacements,
  getGeneratedStreetLights,
} from '../../src/game/world/layout/layoutQueries';
import type { GeneratedPlanetLayout, Point2 } from '../../src/game/world/layout/layoutTypes';

const SEED_COUNT = 60;
const FIRST_SEED = 41_001;

const candidatesBySeed = Array.from({ length: SEED_COUNT }, (_, offset) => {
  const seed = FIRST_SEED + offset;
  const result = generateLayoutCandidates({ seed });
  if (result.status !== 'success') throw new Error(`Seed ${seed} üretilemedi: ${result.reasons.join(', ')}`);
  return { candidates: result.candidates, seed };
});

const everyCandidate: readonly { readonly candidate: GeneratedPlanetLayout; readonly seed: number }[] =
  candidatesBySeed.flatMap(({ candidates, seed }) => candidates.map((candidate) => ({ candidate, seed })));

const label = (seed: number, candidate: GeneratedPlanetLayout, category: string, id: string, point: Point2) =>
  `seed ${seed} · ${candidate.candidateId} · ${category}:${id} · [${point[0]}, ${point[1]}]`;

describe('koloni zemini — sabit kare', () => {
  it('kare 36x36 karedir ve merkezi origin', () => {
    expect(COLONY_GROUND_VERTICES).toHaveLength(4);
    const xs = COLONY_GROUND_VERTICES.map(([x]) => x);
    const zs = COLONY_GROUND_VERTICES.map(([, z]) => z);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    expect(COLONY_GROUND_HALF_EXTENT).toBe(18);
    expect(width).toBe(depth);
    expect(width).toBe(36);
    expect(width).toBe(COLONY_GROUND_HALF_EXTENT * 2);
    expect(xs.reduce((sum, value) => sum + value, 0)).toBe(0);
    expect(zs.reduce((sum, value) => sum + value, 0)).toBe(0);
    expect([...COLONY_GROUND_VERTICES].sort()).toEqual([...COLONY_GROUND_VERTICES].sort());
    for (const [x, z] of COLONY_GROUND_VERTICES) {
      expect(Math.abs(x)).toBe(COLONY_GROUND_HALF_EXTENT);
      expect(Math.abs(z)).toBe(COLONY_GROUND_HALF_EXTENT);
    }
  });

  it(`${SEED_COUNT} seed'in her adayında zemin aynı karedir`, () => {
    expect(everyCandidate.length).toBeGreaterThanOrEqual(SEED_COUNT * 5);
    for (const { candidate, seed } of everyCandidate) {
      expect(candidate.plateauVertices, `seed ${seed} · ${candidate.candidateId}`).toEqual(COLONY_GROUND_VERTICES);
      expect(getGeneratedPlateauVertices(candidate)).toEqual(COLONY_GROUND_VERTICES);
    }
  });

  it('Default (Faz 3) modu da aynı kareyi kullanır', () => {
    expect(getGeneratedPlateauVertices(null)).toEqual(COLONY_GROUND_VERTICES);
  });

  it('hiçbir tesis footprint köşesi kareyi aşmaz', () => {
    for (const { candidate, seed } of everyCandidate) {
      for (const facility of candidate.facilities) {
        for (const rect of [facility.footprint, facility.visualFootprint]) {
          for (const corner of rectCorners(rect)) {
            expect(isInsideColonyGround(corner), label(seed, candidate, 'facility', facility.id, corner)).toBe(true);
          }
        }
        for (const module of facility.visualModules) {
          // Sahnede modüller tesisin döndürülmüş grubunun çocuğu; dünya konumu döndürülerek bulunur.
          const world = moduleWorldPoint(facility.position, module.localPosition, facility.rotationY);
          expect(isInsideColonyGround(world), label(seed, candidate, 'module', module.assetId, world)).toBe(true);
        }
      }
    }
  });

  it('hiçbir yol noktası ve yol karosu kareyi aşmaz', () => {
    for (const { candidate, seed } of everyCandidate) {
      for (const road of candidate.roads) {
        for (const point of road.points) {
          expect(isInsideColonyGround(point), label(seed, candidate, 'road', road.edgeId, point)).toBe(true);
        }
      }
      for (const tile of getGeneratedRoadTilePlacements(candidate)) {
        expect(isInsideColonyGround(tile.position), label(seed, candidate, 'road-tile', 'tile', tile.position)).toBe(true);
      }
    }
  });

  it('hiçbir navigasyon düğümü kareyi aşmaz', () => {
    for (const { candidate, seed } of everyCandidate) {
      for (const node of candidate.navigationNodes) {
        expect(isInsideColonyGround(node.position), label(seed, candidate, 'navigation', node.id, node.position)).toBe(true);
      }
    }
  });

  it('hiçbir sokak lambası kareyi aşmaz', () => {
    for (const { candidate, seed } of everyCandidate) {
      for (const light of getGeneratedStreetLights(candidate)) {
        expect(isInsideColonyGround(light.position), label(seed, candidate, 'street-light', light.id, light.position)).toBe(true);
      }
    }
  });

  it('hiçbir genişleme padi kareyi aşmaz', () => {
    for (const { candidate, seed } of everyCandidate) {
      for (const pad of getGeneratedExpansionPads(candidate)) {
        expect(isInsideColonyGround(pad.position), label(seed, candidate, 'expansion', pad.id, pad.position)).toBe(true);
      }
      for (const slot of candidate.expansionSlots) {
        for (const corner of rectCorners({ center: slot.position, ...slot.footprintCapacity })) {
          expect(isInsideColonyGround(corner), label(seed, candidate, 'expansion-capacity', slot.id, corner)).toBe(true);
        }
      }
    }
  });

  it('render edilen her kaya kareyi aşmaz ve dört kenarı da süsler', () => {
    for (const { candidate, seed } of everyCandidate) {
      const rocks = getGeneratedPropPlacements(candidate);
      expect(rocks.length, `seed ${seed} · ${candidate.candidateId}`).toBeGreaterThanOrEqual(24);
      for (const rock of rocks) {
        expect(isInsideColonyGround(rock.position), label(seed, candidate, 'prop', rock.id, rock.position)).toBe(true);
      }
      for (const zone of candidate.propZones) {
        for (const corner of rectCorners(zone)) {
          expect(isInsideColonyGround(corner), label(seed, candidate, 'prop-zone', zone.id, corner)).toBe(true);
        }
      }
      const edges = { east: 0, north: 0, south: 0, west: 0 };
      for (const zone of candidate.propZones) {
        if (zone.center[1] > COLONY_GROUND_HALF_EXTENT - 3) edges.north += 1;
        if (zone.center[1] < -(COLONY_GROUND_HALF_EXTENT - 3)) edges.south += 1;
        if (zone.center[0] > COLONY_GROUND_HALF_EXTENT - 3) edges.east += 1;
        if (zone.center[0] < -(COLONY_GROUND_HALF_EXTENT - 3)) edges.west += 1;
      }
      for (const [edge, count] of Object.entries(edges)) {
        expect(count, `seed ${seed} · ${candidate.candidateId} · ${edge}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('kaya kuşağı tesislerin ulaştığı en dış noktanın dışında kalır', () => {
    let facilityReach = 0;
    let innermostRock = COLONY_GROUND_HALF_EXTENT;
    for (const { candidate } of everyCandidate) {
      for (const facility of candidate.facilities) {
        for (const corner of rectCorners(facility.visualFootprint)) {
          facilityReach = Math.max(facilityReach, Math.abs(corner[0]), Math.abs(corner[1]));
        }
      }
      for (const rock of getGeneratedPropPlacements(candidate)) {
        innermostRock = Math.min(innermostRock, Math.max(Math.abs(rock.position[0]), Math.abs(rock.position[1])));
      }
    }
    expect(facilityReach).toBeLessThanOrEqual(COLONY_BUILDABLE_HALF_EXTENT);
    expect(innermostRock).toBeGreaterThan(facilityReach);
  });

  it('koloni kareyi DOLDURUR — ortada küçük kalmaz', () => {
    // Tur 1'in şikâyeti: 44x44 karede koloni ortada küçük kalıyordu (tipik erişim 15.9/22 = %72).
    // 36x36 + daraltılmış plato ile tipik erişim karenin yarı-kenarının %80'inin üstünde olmalı.
    const reaches = everyCandidate.map(({ candidate }) => {
      let reach = 0;
      for (const { category, point } of colonyGroundOccupancyPoints(candidate)) {
        if (category === 'prop') continue;
        reach = Math.max(reach, Math.abs(point[0]), Math.abs(point[1]));
      }
      return reach;
    }).sort((a, b) => a - b);
    const median = reaches[Math.floor(reaches.length / 2)] ?? 0;
    expect(median / COLONY_GROUND_HALF_EXTENT).toBeGreaterThan(0.8);
    expect(reaches.at(-1)).toBeLessThan(COLONY_GROUND_PROP_BAND_CENTER - COLONY_GROUND_PROP_BAND_THICKNESS / 2);
  });
});
