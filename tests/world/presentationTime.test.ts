import { describe, expect, it } from 'vitest';

import { SIMULATION_SPEEDS } from '../../src/game/simulation/SimulationClock';
import { mapScreenDragToWorldPan } from '../../src/game/world/prototype/cameraMath';
import { advanceSnowField, createSnowField } from '../../src/game/world/prototype/environmentPresentation';
import { getColonistPose, getMaintenancePose } from '../../src/game/world/prototype/navigation';
import { PresentationClock, getFacilityActivityScale, getHazePosition } from '../../src/game/world/presentation/PresentationClock';

describe('simulation-driven world presentation time', () => {
  it('progresses at ×1', () => {
    const clock = new PresentationClock();
    clock.advance(1, 1);
    expect(clock.getElapsedSeconds()).toBe(1);
    expect(clock.getDeltaSeconds()).toBe(1);
  });

  it('does not progress while paused', () => {
    const clock = new PresentationClock();
    clock.advance(1, 1);
    clock.advance(10, 0);
    expect(clock.getElapsedSeconds()).toBe(1);
    expect(clock.getDeltaSeconds()).toBe(0);
  });

  it('stays unchanged through 100 arbitrary paused render deltas', () => {
    const clock = new PresentationClock();
    clock.advance(0.75, 1);
    const before = clock.getElapsedSeconds();
    for (let index = 1; index <= 100; index += 1) clock.advance(index / 137, 0);
    expect(clock.getElapsedSeconds()).toBe(before);
  });

  it('scales ×2 and ×4 progression from the same render delta', () => {
    const elapsed = (speed: 1 | 2 | 4) => {
      const clock = new PresentationClock();
      clock.advance(0.5, speed);
      return clock.getElapsedSeconds();
    };
    expect(elapsed(2)).toBe(elapsed(1) * 2);
    expect(elapsed(4)).toBe(elapsed(1) * 4);
  });

  it('resumes from the paused value without resetting', () => {
    const clock = new PresentationClock();
    clock.advance(2, 1);
    clock.advance(5, 0);
    const pausedAt = clock.getElapsedSeconds();
    clock.advance(0.5, 1);
    expect(pausedAt).toBe(2);
    expect(clock.getElapsedSeconds()).toBe(2.5);
  });

  it('changes speed without resetting elapsed presentation time', () => {
    const clock = new PresentationClock();
    clock.advance(1, 1);
    clock.advance(1, 2);
    clock.advance(1, 4);
    expect(clock.getElapsedSeconds()).toBe(7);
    expect(SIMULATION_SPEEDS).toEqual([0, 1, 2, 4]);
  });

  it('keeps colonist pose and position identical throughout Pause', () => {
    const clock = new PresentationClock();
    clock.advance(6.25, 1);
    const before = getColonistPose(2, clock.getElapsedSeconds());
    for (let index = 0; index < 100; index += 1) clock.advance(0.016 + index / 10_000, 0);
    const after = getColonistPose(2, clock.getElapsedSeconds());
    expect(after).toEqual(before);
    expect(after.position).toEqual(before.position);
  });

  it('keeps maintenance pose identical throughout Pause', () => {
    const clock = new PresentationClock();
    clock.advance(8.5, 1);
    const before = getMaintenancePose('reactor', clock.getElapsedSeconds());
    clock.advance(100, 0);
    expect(getMaintenancePose('reactor', clock.getElapsedSeconds())).toEqual(before);
  });

  it('keeps facility activity phase identical throughout Pause', () => {
    const clock = new PresentationClock();
    clock.advance(1.4, 1);
    const before = getFacilityActivityScale(1.3, clock.getElapsedSeconds());
    clock.advance(10, 0);
    expect(getFacilityActivityScale(1.3, clock.getElapsedSeconds())).toBe(before);
  });

  it('keeps snow state identical when presentation delta is zero', () => {
    const field = createSnowField(12);
    const positions = [...field.positions];
    const phases = [...field.phase];
    advanceSnowField(field, 0);
    expect([...field.positions]).toEqual(positions);
    expect([...field.phase]).toEqual(phases);
  });

  it('keeps haze presentation identical throughout Pause', () => {
    const clock = new PresentationClock();
    clock.advance(3.7, 1);
    const before = getHazePosition([2, -4], 3, clock.getElapsedSeconds());
    clock.advance(25, 0);
    expect(getHazePosition([2, -4], 3, clock.getElapsedSeconds())).toEqual(before);
  });

  it('leaves camera interaction math independent from presentation Pause', () => {
    const clock = new PresentationClock();
    clock.advance(4, 0);
    expect(mapScreenDragToWorldPan(80, -45, 0.01)).not.toEqual([0, 0]);
    expect(clock.getElapsedSeconds()).toBe(0);
  });

  it('rejects invalid render deltas without inventing presentation time', () => {
    const clock = new PresentationClock();
    expect(() => clock.advance(-1, 1)).toThrow('renderDeltaSeconds');
    expect(() => clock.advance(Number.NaN, 1)).toThrow('renderDeltaSeconds');
  });
});
