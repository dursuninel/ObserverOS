import { generatedPlanetLayoutSchema } from './generatedLayoutSchema';
import { pointInRect, projectedOverlapRatio, projectFacilitiesHeadless, rectContains, rectanglesOverlap, segmentIntersectsRect } from './layoutMath';
import { NIVALIS_LAYOUT_INTENT, NIVALIS_PLACEMENT_PROFILES } from './nivalisLayoutIntent';
import type { GeneratedPlanetLayout, TerrainDefinition } from './layoutTypes';
import { prototypeAssetRegistry } from '../assets/prototypeAssetRegistry';

export interface LayoutValidationResult {
  readonly reasons: readonly string[];
  readonly valid: boolean;
}

function graphConnected(layout: GeneratedPlanetLayout): boolean {
  const first = layout.navigationNodes[0];
  if (!first) return false;
  const visited = new Set<string>();
  const queue = [first.id];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const edge of layout.navigationEdges) {
      if (edge.from === current) queue.push(edge.to);
      if (edge.to === current) queue.push(edge.from);
    }
  }
  return visited.size === layout.navigationNodes.length;
}

export function validateGeneratedLayout(layout: GeneratedPlanetLayout, terrain: TerrainDefinition): LayoutValidationResult {
  const reasons: string[] = [];
  const parsed = generatedPlanetLayoutSchema.safeParse(layout);
  if (!parsed.success) reasons.push(...parsed.error.issues.map((issue) => `schema:${issue.message}`));
  for (const id of NIVALIS_LAYOUT_INTENT.requiredFacilities) if (!layout.facilities.some((facility) => facility.id === id)) reasons.push(`missing-facility:${id}`);

  const buildableAreas = terrain.areas.filter((area) => area.tags.includes('buildable') && !area.tags.includes('blocked'));
  const hazards = terrain.areas.filter((area) => area.tags.includes('hazardZone') || area.tags.includes('blocked'));
  for (const facility of layout.facilities) {
    const profile = NIVALIS_PLACEMENT_PROFILES[facility.id];
    if (!buildableAreas.some((area) => rectContains(area, facility.visualFootprint))) reasons.push(`outside-buildable:${facility.id}`);
    if (hazards.some((area) => rectanglesOverlap(area, facility.visualFootprint))) reasons.push(`forbidden-terrain:${facility.id}`);
    if (facility.visualModules.some((module) => prototypeAssetRegistry.get(module.assetId) === undefined)) reasons.push(`unknown-visual-module:${facility.id}`);
    for (const tag of profile.requiredTerrainTags.filter((tag) => tag !== 'buildable')) {
      if (!terrain.areas.some((area) => area.tags.includes(tag) && pointInRect(facility.position, area))) reasons.push(`required-terrain:${facility.id}:${tag}`);
    }
    const entranceNode = layout.navigationNodes.find((node) => node.id === `${facility.id}-entrance`);
    if (!entranceNode || Math.hypot(entranceNode.position[0] - facility.entrance[0], entranceNode.position[1] - facility.entrance[1]) > 0.01) reasons.push(`entrance-inaccessible:${facility.id}`);
    const workClearance: [number, number] = [facility.workPoint[0], facility.workPoint[1]];
    if (layout.facilities.some((other) => other.id !== facility.id && pointInRect(workClearance, other.footprint, -profile.serviceClearance))) reasons.push(`service-clearance:${facility.id}`);
  }
  for (let first = 0; first < layout.facilities.length; first += 1) {
    for (let second = first + 1; second < layout.facilities.length; second += 1) {
      const a = layout.facilities[first];
      const b = layout.facilities[second];
      if (a && b && rectanglesOverlap(a.visualFootprint, b.visualFootprint, Math.max(NIVALIS_PLACEMENT_PROFILES[a.id].minimumSeparation, NIVALIS_PLACEMENT_PROFILES[b.id].minimumSeparation))) reasons.push(`facility-overlap:${a.id}:${b.id}`);
    }
  }
  if (!graphConnected(layout)) reasons.push('navigation-disconnected');
  if (layout.roads.length !== layout.navigationEdges.length) reasons.push('road-navigation-source-mismatch');
  for (const road of layout.roads) {
    const targetFacilityId = layout.navigationEdges.find((edge) => edge.id === road.edgeId)?.to.replace(/-(approach|entrance)$/, '');
    for (let index = 1; index < road.points.length; index += 1) {
      const start = road.points[index - 1];
      const end = road.points[index];
      if (!start || !end) continue;
      for (const facility of layout.facilities) {
        if (road.role !== 'main-spine' && facility.id === targetFacilityId) continue;
        if (segmentIntersectsRect(start, end, facility.visualFootprint, 0.15)) reasons.push(`road-compound-overlap:${road.edgeId}:${facility.id}`);
      }
    }
  }
  if (layout.expansionSlots.length !== 1 || layout.expansionSlots.some((slot) => slot.footprintCapacity.width < 5 || slot.footprintCapacity.depth < 5)) reasons.push('expansion-capacity');
  const expansion = layout.expansionSlots[0];
  if (expansion && layout.facilities.some((facility) => rectanglesOverlap(facility.visualFootprint, { center: expansion.position, ...expansion.footprintCapacity }, 0.5))) reasons.push('expansion-overlap');
  const projected = projectFacilitiesHeadless(layout.facilities);
  for (let first = 0; first < projected.length; first += 1) for (let second = first + 1; second < projected.length; second += 1) {
    const a = projected[first];
    const b = projected[second];
    if (a && b && projectedOverlapRatio(a, b) > 0.82) reasons.push(`screen-obscured:${a.id}:${b.id}`);
  }
  return { reasons: [...new Set(reasons)].sort(), valid: reasons.length === 0 };
}

export function parseFrozenLayout(input: unknown): GeneratedPlanetLayout {
  return generatedPlanetLayoutSchema.parse(input) as GeneratedPlanetLayout;
}

export function isNavigationConnected(layout: GeneratedPlanetLayout): boolean {
  return graphConnected(layout);
}
