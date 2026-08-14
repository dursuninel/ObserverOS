import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveLayoutSelection } from '../../src/game/ui/colony/layoutModeSelection';
import { generateLayoutCandidates } from '../../src/game/world/layout/layoutGenerator';
import type { LayoutGenerationResult } from '../../src/game/world/layout/layoutTypes';

const failure: LayoutGenerationResult = { status: 'failure', seed: 41_001, attemptedCandidates: 50, reasons: ['structural-generation-failed:central-spine'] };
const emptySuccess = { status: 'success', seed: 41_001, attemptedCandidates: 50, candidates: [] } as unknown as LayoutGenerationResult;

describe('/colony açılış modu ve güvenli geri düşüş', () => {
  it('açılışta ÜRETİLEN tasarımı seçer', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/game/ui/colony/ColonyWorkspace.tsx'), 'utf8');
    expect(source).toContain("useState<LayoutMode>('generated')");
  });

  it('üretim başarılıyken ilk adayı gösterir', () => {
    const result = generateLayoutCandidates({ seed: 41_001 });
    if (result.status !== 'success') throw new Error(`seed 41001 üretilemedi: ${result.reasons.join(', ')}`);
    const selection = resolveLayoutSelection(result, 'generated', 0);
    expect(selection.effectiveMode).toBe('generated');
    expect(selection.generationFallback).toBe(false);
    expect(selection.selectedLayout).toBe(result.candidates[0]);
  });

  it('üretim FAILURE dönerse çökmez, Default’a düşer', () => {
    const selection = resolveLayoutSelection(failure, 'generated', 0);
    expect(selection.effectiveMode).toBe('prototype');
    expect(selection.generationFallback).toBe(true);
    expect(selection.selectedLayout).toBeNull();
    expect(selection.candidates).toEqual([]);
  });

  it('üretim BOŞ aday listesi dönerse de çökmez, Default’a düşer', () => {
    const selection = resolveLayoutSelection(emptySuccess, 'generated', 3);
    expect(selection.effectiveMode).toBe('prototype');
    expect(selection.generationFallback).toBe(true);
    expect(selection.selectedLayout).toBeNull();
  });

  it('geçersiz aday indeksinde ilk adaya döner, hata fırlatmaz', () => {
    const result = generateLayoutCandidates({ seed: 41_001 });
    if (result.status !== 'success') throw new Error('seed 41001 üretilemedi');
    const selection = resolveLayoutSelection(result, 'generated', 99);
    expect(selection.selectedLayout).toBe(result.candidates[0]);
    expect(selection.generationFallback).toBe(false);
  });

  it('kullanıcı Default seçtiğinde Faz 3 sabit yerleşimi render edilir', () => {
    const result = generateLayoutCandidates({ seed: 41_001 });
    if (result.status !== 'success') throw new Error('seed 41001 üretilemedi');
    const selection = resolveLayoutSelection(result, 'prototype', 0);
    expect(selection.effectiveMode).toBe('prototype');
    expect(selection.selectedLayout).toBeNull();
    expect(selection.generationFallback).toBe(false);
    expect(selection.candidates.length).toBeGreaterThanOrEqual(5);
  });

  it('ColonyWorkspace üretim hatasında artık throw etmiyor (TASK-MSRPKXFR6B1LV regresyonu)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/game/ui/colony/ColonyWorkspace.tsx'), 'utf8');
    expect(source).not.toContain('throw new Error');
    expect(source).toContain('resolveLayoutSelection');
  });
});
