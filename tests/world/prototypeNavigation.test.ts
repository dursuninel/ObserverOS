import { describe, expect, it } from 'vitest';

import { findPath, getColonistPose, NAV_GRAPH } from '../../src/game/world/prototype/navigation';

describe('prototype presentation navigation', () => {
  it('finds a deterministic A* route on the declared road graph', () => {
    expect(findPath('reactor', 'oxygen')).toEqual(['reactor', 'center', 'oxygen']);
    expect(findPath('reactor', 'oxygen')).toEqual(findPath('reactor', 'oxygen'));
  });

  it('keeps a walking colonist on graph segments', () => {
    const pose = getColonistPose(0, 4);
    expect(pose.state).toBe('walking-to-facility');
    expect(pose.animation).toBe('Walk');
    const center = NAV_GRAPH.habitat.position;
    const reactor = NAV_GRAPH.reactor.position;
    expect(pose.position[0]).toBeGreaterThanOrEqual(reactor[0]);
    expect(pose.position[0]).toBeLessThanOrEqual(center[0]);
  });

  it('exposes idle and working presentation phases without gameplay state', () => {
    expect(getColonistPose(0, 0).state).toBe('resting');
    expect(getColonistPose(0, 2.2).state).toBe('assigned');
    expect(getColonistPose(0, 8).state).toBe('working');
    expect(getColonistPose(0, 12).state).toBe('walking-to-habitat');
  });
});
