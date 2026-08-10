import { accessSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { prototypeAssetDefinitions, requirePrototypeAsset } from '../../src/game/world/assets/prototypeAssetRegistry';

describe('prototype runtime assets', () => {
  it('registers only physical runtime files with source provenance', () => {
    expect(prototypeAssetDefinitions).toHaveLength(22);
    for (const asset of prototypeAssetDefinitions) {
      expect(asset.originalPath.startsWith('assets-source/')).toBe(true);
      expect(asset.runtimePath.startsWith('/assets/runtime/')).toBe(true);
      accessSync(resolve('public', asset.runtimePath.slice(1)));
    }
  });

  it('fails fast for a missing prototype registry entry', () => {
    expect(() => requirePrototypeAsset('missing-asset')).toThrow(/not registered/);
  });

  it('keeps exact source titles and license references in the runtime manifest', () => {
    const manifest = JSON.parse(readFileSync('public/assets/runtime/license-manifest.json', 'utf8')) as { assets: Array<{ id: string; licenseFile: string }>; packs: Array<{ sourceLicense: string; sourceTitle: string }> };
    expect(manifest.packs).toHaveLength(4);
    expect(manifest.packs.find((pack) => pack.sourceLicense.includes('quaternius-ultimate'))?.sourceTitle).toBe('Ultimate Platformer Pack');
    expect(manifest.assets.map((asset) => asset.id).sort()).toEqual(prototypeAssetDefinitions.map((asset) => asset.id).sort());
    expect(manifest.assets.every((asset) => asset.licenseFile.startsWith('assets-source/'))).toBe(true);
  });

  it('caps generated runtime PNG variants at 1024 pixels', () => {
    for (const pack of ['modular', 'essentials']) {
      const directory = resolve('public/assets/runtime', pack);
      for (const file of readdirSync(directory).filter((name) => name.endsWith('.png'))) {
        const png = readFileSync(resolve(directory, file));
        expect(png.readUInt32BE(16)).toBeLessThanOrEqual(1024);
        expect(png.readUInt32BE(20)).toBeLessThanOrEqual(1024);
      }
    }
  });
});
