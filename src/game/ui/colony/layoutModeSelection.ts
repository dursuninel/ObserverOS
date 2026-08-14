import type { GeneratedPlanetLayout, LayoutGenerationResult } from '../../world/layout/layoutTypes';

export type LayoutMode = 'generated' | 'prototype';

export interface LayoutSelection {
  readonly candidates: readonly GeneratedPlanetLayout[];
  readonly effectiveMode: LayoutMode;
  /** Üretim istendi ama tek bir aday bile alınamadı — kullanıcıya uyarı gösterilir. */
  readonly generationFallback: boolean;
  /** `null` ⇒ Faz 3 sabit yerleşimi (Default) render edilir. */
  readonly selectedLayout: GeneratedPlanetLayout | null;
}

/**
 * /colony ÜRETİLEN tasarımla açılır. Üretim `failure` dönerse veya hiç aday üretmezse ekran
 * ÇÖKMEZ; Faz 3 sabit yerleşimine (Default) güvenli şekilde geri düşer.
 *
 * Bu karar bilerek saf bir fonksiyona ayrıldı: eskiden `ColonyWorkspace` içinde `throw` ediliyordu
 * ve varsayılan mod 'generated' olduğunda /colony açılışını komple çökertiyordu
 * (TASK-MSRPKXFR6B1LV regresyonu). Saf olduğu için DOM'a ihtiyaç duymadan test edilebilir.
 */
export function resolveLayoutSelection(result: LayoutGenerationResult, requestedMode: LayoutMode, selectedCandidateIndex: number): LayoutSelection {
  const candidates = result.status === 'success' ? result.candidates : [];
  const generationFallback = candidates.length === 0;
  const effectiveMode: LayoutMode = generationFallback ? 'prototype' : requestedMode;
  return {
    candidates,
    effectiveMode,
    generationFallback,
    selectedLayout: effectiveMode === 'prototype' ? null : (candidates[selectedCandidateIndex] ?? candidates[0] ?? null),
  };
}
