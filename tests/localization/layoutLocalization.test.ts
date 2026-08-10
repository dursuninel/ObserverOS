import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { tr } from '../../src/localization/tr';

describe('Faz 4 Turkish layout review', () => {
  it('provides every visible candidate review label through localization', () => {
    expect(tr.layoutReview).toMatchObject({
      title: 'YERLEŞİM ADAYLARI', seed: 'TOHUM', profile: 'PROFİL', total: 'TOPLAM PUAN',
      adjacency: 'YAKINLIK', road: 'YOL KALİTESİ', readability: 'EKRAN OKUNABİLİRLİĞİ',
      composition: 'KOMPOZİSYON', expansion: 'GENİŞLEME', terrain: 'ARAZİ KULLANIMI',
      roadNetwork: 'YOL AĞI', navigation: 'NAVİGASYON', valid: 'GEÇERLİ',
    });
  });

  it('keeps raw English candidate labels out of the component', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/game/ui/colony/LayoutCandidatePanel.tsx'), 'utf8');
    for (const raw of ['TOTAL SCORE', 'ROAD QUALITY', 'VALID:', 'SEED SWEEP', 'NEXT CANDIDATE']) expect(source).not.toContain(raw);
  });

  it('guards generator and seed sweep behind the DEV review boundary', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/game/ui/colony/ColonyWorkspace.tsx'), 'utf8');
    expect(source).toContain('import.meta.env.DEV ? generateLayoutCandidates');
    expect(source).toContain('import.meta.env.DEV ? runLayoutSeedSweep');
  });
});
