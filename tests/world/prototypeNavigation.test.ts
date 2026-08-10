import { describe, expect, it } from 'vitest';

import { findPath, getColonistPose } from '../../src/game/world/prototype/navigation';

describe('prototype presentation navigation', () => {
  it('finds the same deterministic A* route for identical inputs', () => {
    const first = findPath('habitat-entrance', 'oxygen-entrance');
    expect(first[0]).toBe('habitat-entrance');
    expect(first.at(-1)).toBe('oxygen-entrance');
    expect(first).toEqual(findPath('habitat-entrance', 'oxygen-entrance'));
  });

  it('exposes the complete presentation flow and hides indoor working', () => {
    expect(getColonistPose(0, 0)).toMatchObject({ state: 'resting', visible: true });
    expect(getColonistPose(0, 2.2)).toMatchObject({ state: 'assigned', visible: true });
    expect(getColonistPose(0, 4)).toMatchObject({ animation: 'Walk', state: 'walking-to-facility', visible: true });
    expect(getColonistPose(0, 8)).toMatchObject({ state: 'working', visible: false });
    expect(getColonistPose(0, 12)).toMatchObject({ state: 'walking-to-habitat', visible: true });
  });
});
