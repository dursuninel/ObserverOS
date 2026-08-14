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

// Bileşke ayak izleri Faz 3 sabit yerleşimine yaklaşacak şekilde sıkılaştırıldı: annex ve tunnel
// modülleri merkeze çekildi ve ölçekleri düşürüldü. Ölçüm: altı bileşkenin toplam genişliği
// jeneratörün ulaşabileceği en dar spanX'i belirliyor; eski değerlerde habitat tek başına
// 11.2 birimdi ve koloni Default'un 16 birimlik span'ine geometrik olarak sığamıyordu.
export const HABITAT_VISUAL_COMPOUNDS: Readonly<Record<HabitatVisualVariantId, VisualCompoundProfile>> = Object.freeze({
  'compact-pod': { id: 'compact-pod', width: 4.4, depth: 4.6, modules: [module('road-tile', 0, 2.1, 0, 0.42, 'plaza')] },
  courtyard: { id: 'courtyard', width: 7, depth: 6.4, modules: [module('habitat-tunnel', 1.15, 0, Math.PI / 2, 0.74, 'connector'), module('habitat-annex', 2.35, 0, 0, 0.76, 'annex'), module('habitat-tunnel', -1.15, 0, Math.PI / 2, 0.74, 'connector'), module('habitat-annex', -2.35, 0, 0, 0.76, 'annex'), module('road-tile', 0, 2.15, 0, 0.6, 'plaza')] },
  'linear-compound': { id: 'linear-compound', width: 8, depth: 4.6, modules: [module('habitat-tunnel', 1.1, 0, Math.PI / 2, 0.74, 'connector'), module('habitat-annex', 2.25, 0, 0, 0.76, 'annex'), module('habitat-tunnel', -1.1, 0, Math.PI / 2, 0.74, 'connector'), module('habitat-annex', -2.25, 0, 0, 0.66, 'annex')] },
  'clustered-habitat': { id: 'clustered-habitat', width: 6.6, depth: 6.6, modules: [module('habitat-tunnel', 1.1, 0.2, Math.PI / 2, 0.72, 'connector'), module('habitat-annex', 2.1, 0.3, 0, 0.76, 'annex'), module('habitat-annex', -1.3, -1.95, Math.PI / 2, 0.64, 'annex'), module('road-tile', 0.45, 2.1, 0, 0.54, 'plaza')] },
  'service-yard': { id: 'service-yard', width: 6, depth: 5.8, modules: [module('habitat-tunnel', 1.1, 0, Math.PI / 2, 0.7, 'connector'), module('habitat-annex', 2.15, 0, 0, 0.7, 'annex'), module('road-tile', -0.95, 2.1, 0, 0.58, 'plaza'), module('supply-crate', -1.7, 1.9, 0.35, 0.62, 'service-prop')] },
});

const OTHER_VISUAL_COMPOUNDS: Readonly<Record<Exclude<FacilityId, 'habitat'>, readonly VisualCompoundProfile[]>> = Object.freeze({
  solar: [
    { id: 'two-panel-line', width: 3.6, depth: 2.4, modules: [module('solar-panel', 1.45, 0, 0, 0.9, 'panel')] },
    { id: 'three-panel-line', width: 4.8, depth: 2.6, modules: [module('solar-panel', -1.45, 0, 0, 0.9, 'panel'), module('solar-panel', 1.45, 0, 0, 0.9, 'panel')] },
    { id: 'l-panel-bank', width: 4.4, depth: 3.8, modules: [module('solar-panel', 1.4, 0, 0, 0.9, 'panel'), module('solar-panel', 0, 1.25, Math.PI / 2, 0.9, 'panel')] },
  ],
  reactor: [
    { id: 'tower-core', width: 4.3, depth: 4.6, modules: [module('reactor-tower', 0, 0, 0, 1, 'technical-module')] },
    { id: 'tower-service-pad', width: 5.4, depth: 4.8, modules: [module('reactor-tower', 0, 0, 0, 1, 'technical-module'), module('road-tile', 1.75, 0.35, 0, 0.38, 'plaza')] },
  ],
  battery: [
    { id: 'roof-bank', width: 3.8, depth: 4, modules: [module('battery-cargo', 0, 0, 0, 1, 'technical-module')] },
    { id: 'service-bank', width: 4.9, depth: 4.3, modules: [module('battery-cargo', 0, 0, 0, 1, 'technical-module'), module('supply-crate', 1.6, 0.65, Math.PI / 2, 0.62, 'service-prop')] },
  ],
  mine: [
    { id: 'drill-only', width: 4.2, depth: 4.4, modules: [] },
    { id: 'drill-service-yard', width: 5.6, depth: 5, modules: [module('road-tile', 1.7, 0.4, 0, 0.38, 'plaza'), module('supply-crate', 1.7, 0.25, 0.6, 0.6, 'service-prop')] },
  ],
  oxygen: [
    { id: 'vented-core', width: 4.2, depth: 4.2, modules: [module('oxygen-vent', 0, 0, 0, 1, 'technical-module')] },
    { id: 'service-vent-core', width: 4.9, depth: 4.4, modules: [module('oxygen-vent', 0, 0, 0, 1, 'technical-module'), module('supply-crate', -1.6, 0.55, 0.3, 0.56, 'service-prop')] },
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
