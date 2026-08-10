import { describe, expect, it } from 'vitest';

import { advanceSnowField, createSnowField, PROTOTYPE_SNOW_BOUNDS } from '../../src/game/world/prototype/environmentPresentation';

describe('prototype frozen environment presentation', () => {
  it('creates deterministic varied snow initial state', () => {
    const first = createSnowField(24);
    const second = createSnowField(24);
    expect([...first.positions]).toEqual([...second.positions]);
    expect([...new Set(first.speed)]).toHaveLength(24);
    expect([...new Set(first.drift)]).toHaveLength(24);
  });

  it('falls, drifts and wraps flakes from ground to the ceiling', () => {
    const field = createSnowField(2);
    const startX = field.positions[0] ?? 0;
    field.positions[1] = PROTOTYPE_SNOW_BOUNDS.floor + 0.01;
    advanceSnowField(field, 1);
    expect(field.positions[0]).toBeGreaterThan(startX);
    expect(field.positions[1]).toBeGreaterThan(PROTOTYPE_SNOW_BOUNDS.ceiling - 1.6);
  });
});
