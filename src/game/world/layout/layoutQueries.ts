import type { FacilityId } from '../prototype/types';
import type { TravelNetworkConfig } from '../../domain/workforce/TravelNetwork';
import type { GeneratedPlanetLayout, LayoutEntityId, Point2 } from './layoutTypes';

export function getGeneratedFacility(layout: GeneratedPlanetLayout, id: FacilityId) {
  const facility = layout.facilities.find((candidate) => candidate.id === id);
  if (!facility) throw new Error(`Generated facility "${id}" is missing.`);
  return facility;
}

export function getGeneratedRoadNode(layout: GeneratedPlanetLayout, id: string) {
  const node = layout.navigationNodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Generated road node "${id}" is missing.`);
  return node;
}

export function getGeneratedRoadNeighbors(layout: GeneratedPlanetLayout, id: string): readonly string[] {
  return layout.navigationEdges.flatMap((edge) => edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : []).sort();
}

export function getGeneratedRoadTilePlacements(layout: GeneratedPlanetLayout, spacing = 1.25): readonly { readonly position: Point2; readonly rotationY: number }[] {
  const placements: { position: Point2; rotationY: number }[] = [];
  for (const road of layout.roads) {
    for (let segment = 0; segment < road.points.length - 1; segment += 1) {
      const from = road.points[segment]; const to = road.points[segment + 1];
      if (!from || !to) continue;
      const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const count = Math.max(1, Math.ceil(distance / spacing));
      for (let index = 0; index <= count; index += 1) {
        const progress = index / count;
        placements.push({ position: [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress], rotationY: Math.atan2(to[0] - from[0], to[1] - from[1]) });
      }
    }
  }
  const unique = new Map(placements.map((placement) => [`${placement.position[0].toFixed(2)}:${placement.position[1].toFixed(2)}`, placement]));
  return [...unique.values()];
}

export function generatedEntrance(layout: GeneratedPlanetLayout, id: LayoutEntityId): Point2 {
  return getGeneratedRoadNode(layout, `${id}-entrance`).position;
}

export function generatedLayoutToTravelNetwork(layout: GeneratedPlanetLayout, walkingSpeedUnitsPerSimulationMinute: number): TravelNetworkConfig {
  return {
    walkingSpeedUnitsPerSimulationMinute,
    locationNodes: {
      'battery-01': 'battery-entrance',
      habitat: 'habitat-entrance',
      'mine-01': 'mine-entrance',
      'oxygen-processor-01': 'oxygen-entrance',
      'reactor-01': 'reactor-entrance',
    },
    nodes: layout.navigationNodes.map((node) => ({ id: node.id, x: node.position[0], z: node.position[1] })),
    edges: layout.navigationEdges.map((edge) => ({ from: edge.from, to: edge.to })),
  };
}
