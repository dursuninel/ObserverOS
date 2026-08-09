import { describe, expect, it } from 'vitest';

import { AssetRegistry } from '../../src/game/world/assets/AssetRegistry';

const definition = {
  id: 'test-asset',
  sourceBounds: { depth: 1, height: 1, width: 1 },
  sourceFile: 'test.glb',
  sourcePack: 'test-fixture',
} as const;

describe('AssetRegistry', () => {
  it('registers metadata without loading renderer assets', () => {
    const registry = new AssetRegistry();

    registry.register(definition);

    expect(registry.get(definition.id)).toBe(definition);
  });

  it('rejects duplicate stable identifiers', () => {
    const registry = new AssetRegistry();
    registry.register(definition);

    expect(() => registry.register(definition)).toThrow(/already registered/);
  });
});

