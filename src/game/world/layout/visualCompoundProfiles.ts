import type { FacilityId } from '../prototype/types';
import type { DeterministicRng } from './deterministicRng';
import type { GeneratedVisualModule, HabitatVisualVariantId } from './layoutTypes';

export interface VisualCompoundProfile {
  readonly depth: number;
  readonly id: string;
  readonly modules: readonly GeneratedVisualModule[];
  readonly width: number;
}

const module = (assetId: string, x: number, z: number, rotationY: number, scale: number, semanticVisualRole: GeneratedVisualModule['semanticVisualRole']): GeneratedVisualModule => ({ assetId, localPosition: [x, z], rotationY, scale, semanticVisualRole });

export const HABITAT_VISUAL_COMPOUNDS: Readonly<Record<HabitatVisualVariantId, VisualCompoundProfile>> = Object.freeze({
  'compact-pod': { id: 'compact-pod', width: 4.8, depth: 5.2, modules: [module('road-tile', 0, 2.45, 0, 0.48, 'plaza')] },
  courtyard: { id: 'courtyard', width: 9.6, depth: 8.4, modules: [module('habitat-tunnel', 1.55, 0, Math.PI / 2, 1, 'connector'), module('habitat-annex', 3.25, 0, 0, 1, 'annex'), module('habitat-tunnel', -1.55, 0, Math.PI / 2, 1, 'connector'), module('habitat-annex', -3.25, 0, 0, 1, 'annex'), module('road-tile', 0, 2.7, 0, 0.72, 'plaza')] },
  'linear-compound': { id: 'linear-compound', width: 11.2, depth: 5.2, modules: [module('habitat-tunnel', 1.5, 0, Math.PI / 2, 1, 'connector'), module('habitat-annex', 3.15, 0, 0, 1, 'annex'), module('habitat-tunnel', -1.5, 0, Math.PI / 2, 1, 'connector'), module('habitat-annex', -3.15, 0, 0, 0.86, 'annex')] },
  'clustered-habitat': { id: 'clustered-habitat', width: 8.8, depth: 8.8, modules: [module('habitat-tunnel', 1.45, 0.25, Math.PI / 2, 0.95, 'connector'), module('habitat-annex', 2.8, 0.4, 0, 1, 'annex'), module('habitat-annex', -1.7, -2.5, Math.PI / 2, 0.82, 'annex'), module('road-tile', 0.6, 2.65, 0, 0.62, 'plaza')] },
  'service-yard': { id: 'service-yard', width: 7.8, depth: 7.4, modules: [module('habitat-tunnel', 1.45, 0, Math.PI / 2, 0.92, 'connector'), module('habitat-annex', 2.85, 0, 0, 0.9, 'annex'), module('road-tile', -1.25, 2.65, 0, 0.68, 'plaza'), module('supply-crate', -2.2, 2.4, 0.35, 0.72, 'service-prop')] },
});

const OTHER_VISUAL_COMPOUNDS: Readonly<Record<Exclude<FacilityId, 'habitat'>, readonly VisualCompoundProfile[]>> = Object.freeze({
  solar: [
    { id: 'two-panel-line', width: 4, depth: 2.4, modules: [module('solar-panel', 1.8, 0, 0, 1, 'panel')] },
    { id: 'three-panel-line', width: 5.8, depth: 2.6, modules: [module('solar-panel', -1.8, 0, 0, 1, 'panel'), module('solar-panel', 1.8, 0, 0, 1, 'panel')] },
    { id: 'l-panel-bank', width: 5.2, depth: 4.4, modules: [module('solar-panel', 1.7, 0, 0, 1, 'panel'), module('solar-panel', 0, 1.5, Math.PI / 2, 1, 'panel')] },
  ],
  reactor: [
    { id: 'tower-core', width: 4.3, depth: 4.6, modules: [module('reactor-tower', 0, 0, 0, 1, 'technical-module')] },
    { id: 'tower-service-pad', width: 6.4, depth: 5.2, modules: [module('reactor-tower', 0, 0, 0, 1, 'technical-module'), module('road-tile', 2.2, 0.4, 0, 0.42, 'plaza')] },
  ],
  battery: [
    { id: 'roof-bank', width: 3.8, depth: 4, modules: [module('battery-cargo', 0, 0, 0, 1, 'technical-module')] },
    { id: 'service-bank', width: 5.8, depth: 4.6, modules: [module('battery-cargo', 0, 0, 0, 1, 'technical-module'), module('supply-crate', 2, 0.8, Math.PI / 2, 0.7, 'service-prop')] },
  ],
  mine: [
    { id: 'drill-only', width: 4.2, depth: 4.4, modules: [] },
    { id: 'drill-service-yard', width: 6.6, depth: 5.6, modules: [module('road-tile', 2.1, 0.5, 0, 0.42, 'plaza'), module('supply-crate', 2.1, 0.3, 0.6, 0.68, 'service-prop')] },
  ],
  oxygen: [
    { id: 'vented-core', width: 4.2, depth: 4.2, modules: [module('oxygen-vent', 0, 0, 0, 1, 'technical-module')] },
    { id: 'service-vent-core', width: 5.8, depth: 4.8, modules: [module('oxygen-vent', 0, 0, 0, 1, 'technical-module'), module('supply-crate', -2, 0.7, 0.3, 0.62, 'service-prop')] },
  ],
});

export function getVisualCompound(id: FacilityId, habitatVariant: HabitatVisualVariantId, rng: DeterministicRng): VisualCompoundProfile {
  if (id === 'habitat') return HABITAT_VISUAL_COMPOUNDS[habitatVariant];
  const variants = OTHER_VISUAL_COMPOUNDS[id];
  const selected = variants[Math.floor(rng.next() * variants.length) % variants.length] ?? variants[0];
  if (!selected) throw new Error(`Visual compound variants are missing for ${id}.`);
  return selected;
}

export function visualCompoundVariantCount(id: FacilityId): number {
  return id === 'habitat' ? Object.keys(HABITAT_VISUAL_COMPOUNDS).length : OTHER_VISUAL_COMPOUNDS[id].length;
}
