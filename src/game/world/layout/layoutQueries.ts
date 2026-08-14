import { getFacilityPlacement, getRoadTilePlacements, getStreetLightPlacements, PROTOTYPE_LAYOUT } from '../prototype/prototypeLayout';
import { colonyGroundPropZones } from './colonyGround';
import type { FacilityId } from '../prototype/types';
import type { TravelNetworkConfig } from '../../domain/workforce/TravelNetwork';
import type { GeneratedFacilityPlacement, GeneratedPlanetLayout, GeneratedVisualModule, LayoutEntityId, Point2 } from './layoutTypes';

/**
 * Faz 3 sabit yerleşimi ("Default") ile Faz 4 üretilmiş yerleşimin ortak render sözleşmesi.
 * layout === null ⇒ Faz 3 PROTOTYPE_LAYOUT dondurulmuş verisi kullanılır; renderer
 * yerleşim seçimi yapmaz, yalnız bu sorguların döndürdüğünü tüketir.
 */
export interface RenderFacilityPlacement {
  readonly position: Point2;
  readonly primaryAssetId: string;
  readonly rotationY: number;
  readonly visualModules: readonly GeneratedVisualModule[];
  readonly visualVariantId: string | null;
}

export interface RenderPropPlacement {
  readonly assetId: string;
  readonly elevation: number;
  readonly id: string;
  readonly position: Point2;
  readonly rotationY: number;
  readonly scale: number;
}

export function getGeneratedFacility(layout: GeneratedPlanetLayout, id: FacilityId): GeneratedFacilityPlacement;
export function getGeneratedFacility(layout: GeneratedPlanetLayout | null, id: FacilityId): RenderFacilityPlacement;
export function getGeneratedFacility(layout: GeneratedPlanetLayout | null, id: FacilityId): RenderFacilityPlacement {
  if (layout === null) {
    const placement = getFacilityPlacement(id);
    return { position: placement.position, primaryAssetId: placement.primaryAssetId, rotationY: placement.rotationY, visualModules: [], visualVariantId: null };
  }
  const facility = layout.facilities.find((candidate) => candidate.id === id);
  if (!facility) throw new Error(`Generated facility "${id}" is missing.`);
  return facility;
}

export function getGeneratedStreetLights(layout: GeneratedPlanetLayout | null): readonly { readonly id: string; readonly position: Point2 }[] {
  if (layout === null) return getStreetLightPlacements().map((position) => ({ id: `prototype-light-${position[0]}:${position[1]}`, position }));
  return layout.streetLights.map((light) => ({ id: light.id, position: light.position }));
}

export function getGeneratedPlateauVertices(layout: GeneratedPlanetLayout | null): readonly Point2[] {
  return layout === null ? PROTOTYPE_LAYOUT.plateauVertices : layout.plateauVertices;
}

export function getGeneratedHazeAnchors(layout: GeneratedPlanetLayout | null): readonly Point2[] {
  if (layout === null) return PROTOTYPE_LAYOUT.hazeAnchors;
  const { minX, maxX, minZ, maxZ, center } = layout.cameraBounds;
  return [[minX + 2, maxZ - 2], [minX + 5, minZ + 2], [center[0], maxZ - 1.5], [maxX - 5, minZ + 2], [maxX - 2, maxZ - 3]];
}

export function getGeneratedExpansionPads(layout: GeneratedPlanetLayout | null): readonly { readonly id: string; readonly position: Point2; readonly rotationY: number }[] {
  if (layout === null) {
    const placement = getFacilityPlacement('expansion');
    return [{ id: placement.id, position: placement.position, rotationY: placement.rotationY }];
  }
  return layout.expansionSlots.map((slot) => ({ id: slot.id, position: slot.position, rotationY: slot.rotationY }));
}

const propZoneRocks = (zones: GeneratedPlanetLayout['propZones']): readonly RenderPropPlacement[] =>
  zones.flatMap((zone) => [-0.33, 0.33].map((offset, index): RenderPropPlacement => ({
    assetId: index % 2 ? 'rock-small-a' : 'rock-small-b',
    elevation: 0.12,
    id: `${zone.id}-${index}`,
    position: [zone.center[0] + offset * zone.width, zone.center[1] + (index ? -0.27 : 0.27) * zone.depth],
    rotationY: (zone.seedOffset + index) * 0.73,
    scale: 1,
  })));

export function getGeneratedPropPlacements(layout: GeneratedPlanetLayout | null): readonly RenderPropPlacement[] {
  if (layout === null) {
    // Zemin Default'ta da aynı karedir, dolayısıyla kenar kaya kuşağı da aynıdır; Faz 3'ün kendi
    // kaya/sandık yerleşimi dondurulmuş hâliyle korunur.
    return [
      ...PROTOTYPE_LAYOUT.zones.outerRocks.map(([x, z, rotation, scale], index): RenderPropPlacement => ({ assetId: 'rock-large', elevation: 0.12, id: `outer-${index}`, position: [x, z], rotationY: rotation, scale })),
      ...PROTOTYPE_LAYOUT.zones.transitionRocks.map(([x, z, rotation], index): RenderPropPlacement => ({ assetId: index % 2 ? 'rock-small-a' : 'rock-small-b', elevation: 0.12, id: `transition-${index}`, position: [x, z], rotationY: rotation, scale: 1 })),
      ...PROTOTYPE_LAYOUT.zones.coreCrates.map(([x, z, rotation], index): RenderPropPlacement => ({ assetId: 'supply-crate', elevation: 0.14, id: `crate-${index}`, position: [x, z], rotationY: rotation, scale: 1 })),
      ...propZoneRocks(colonyGroundPropZones(0, 0)),
    ];
  }
  return propZoneRocks(layout.propZones);
}

export function getGeneratedRoadNode(layout: GeneratedPlanetLayout, id: string) {
  const node = layout.navigationNodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Generated road node "${id}" is missing.`);
  return node;
}

export function getGeneratedRoadNeighbors(layout: GeneratedPlanetLayout, id: string): readonly string[] {
  return layout.navigationEdges.flatMap((edge) => edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : []).sort();
}

export function getGeneratedRoadTilePlacements(layout: GeneratedPlanetLayout | null, spacing = 1.25): readonly { readonly position: Point2; readonly rotationY: number }[] {
  if (layout === null) return getRoadTilePlacements(spacing);
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
