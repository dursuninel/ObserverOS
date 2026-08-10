import { describe, expect, it } from 'vitest';

import { allRoadNodeIds, findPath } from '../../src/game/world/prototype/navigation';
import { getFacilityFootprint, getFacilityPlacement, getHabitatPresentationPoints, getRoadNode, getRoadNeighbors, getRoadTilePlacements, getStreetLightPlacements, PROTOTYPE_LAYOUT, segmentIntersectsFootprint, transformLocalPointToWorld } from '../../src/game/world/prototype/prototypeLayout';

const entityIds = ['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen', 'expansion'] as const;

describe('handcrafted prototype layout', () => {
  it('connects every facility entrance to the road graph', () => {
    for (const id of entityIds) {
      const entranceId = `${id}-entrance`;
      expect(getRoadNode(entranceId).entityId).toBe(id);
      expect(getRoadNeighbors(entranceId)).toEqual([`${id}-approach`]);
    }
  });

  it('provides a habitat route to every facility and the expansion pad', () => {
    for (const id of entityIds.filter((id) => id !== 'habitat')) {
      const path = findPath('habitat-entrance', `${id}-entrance`);
      expect(path[0]).toBe('habitat-entrance');
      expect(path.at(-1)).toBe(`${id}-entrance`);
    }
  });

  it('contains no disconnected nodes or edges with missing endpoints', () => {
    const ids = new Set(allRoadNodeIds());
    for (const edge of PROTOTYPE_LAYOUT.roadEdges) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    }
    const visited = new Set<string>();
    const queue = [PROTOTYPE_LAYOUT.roadNodes[0]?.id ?? ''];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      queue.push(...getRoadNeighbors(current));
    }
    expect(visited).toEqual(ids);
  });

  it('uses the same road edge source for visible tiles and walkable neighbors', () => {
    expect(getRoadTilePlacements().length).toBeGreaterThan(PROTOTYPE_LAYOUT.roadEdges.length);
    for (const edge of PROTOTYPE_LAYOUT.roadEdges) {
      expect(getRoadNeighbors(edge.from)).toContain(edge.to);
      expect(getRoadNeighbors(edge.to)).toContain(edge.from);
    }
  });

  it('keeps every walkable segment outside every forbidden facility footprint', () => {
    for (const edge of PROTOTYPE_LAYOUT.roadEdges) {
      const start = getRoadNode(edge.from).position;
      const end = getRoadNode(edge.to).position;
      for (const id of entityIds) {
        expect(segmentIntersectsFootprint(start, end, getFacilityFootprint(id))).toBe(false);
      }
    }
  });

  it('derives street lights from valid road nodes', () => {
    const litNodes = PROTOTYPE_LAYOUT.roadNodes.filter((node) => node.light);
    const lights = getStreetLightPlacements();
    expect(lights).toHaveLength(litNodes.length);
    lights.forEach((light, index) => {
      const node = litNodes[index];
      expect(node).toBeDefined();
      expect(Math.hypot(light[0] - (node?.position[0] ?? 0), light[1] - (node?.position[1] ?? 0))).toBeCloseTo(0.9);
    });
  });

  it('detects a segment that really crosses a footprint', () => {
    const footprint = getFacilityFootprint('reactor');
    expect(segmentIntersectsFootprint([footprint.center[0] - 4, footprint.center[1]], [footprint.center[0] + 4, footprint.center[1]], footprint)).toBe(true);
  });

  it('derives Habitat presentation points from local coordinates', () => {
    const placement = getFacilityPlacement('habitat');
    const points = getHabitatPresentationPoints();
    expect(points.restPoints[0]).toEqual(transformLocalPointToWorld(PROTOTYPE_LAYOUT.habitat.localRestPoints[0] ?? [0, 0], placement));
    expect(points.stagingPoints).toHaveLength(PROTOTYPE_LAYOUT.habitat.localStagingPoints.length);
    expect(points.departurePoints).toHaveLength(PROTOTYPE_LAYOUT.habitat.localDeparturePoints.length);
  });

  it('moves and rotates every Habitat presentation point with its placement', () => {
    const original = getHabitatPresentationPoints({ position: [1.5, -3.6], rotationY: 0 });
    const moved = getHabitatPresentationPoints({ position: [8.5, 2.4], rotationY: Math.PI / 2 });
    const expected = PROTOTYPE_LAYOUT.habitat.localRestPoints.map((point) => transformLocalPointToWorld(point, { position: [8.5, 2.4], rotationY: Math.PI / 2 }));
    expect(moved.restPoints).toEqual(expected);
    expect(moved.restPoints).not.toEqual(original.restPoints);
  });
});
