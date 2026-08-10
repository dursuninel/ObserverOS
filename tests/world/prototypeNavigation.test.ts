import { describe, expect, it } from 'vitest';

import { PROTOTYPE_CHARACTER_ANIMATION_CLIPS } from '../../src/game/world/assets/prototypeAssetRegistry';
import { findPath, getColonistPose, getColonistSchedule, getMaintenanceCycleDuration, getMaintenancePose, validatePrototypeCharacterClips } from '../../src/game/world/prototype/navigation';
import { PROTOTYPE_LAYOUT } from '../../src/game/world/prototype/prototypeLayout';

describe('prototype presentation navigation', () => {
  it('finds the same deterministic A* route for identical inputs', () => {
    const first = findPath('habitat-entrance', 'oxygen-entrance');
    expect(first[0]).toBe('habitat-entrance');
    expect(first.at(-1)).toBe('oxygen-entrance');
    expect(first).toEqual(findPath('habitat-entrance', 'oxygen-entrance'));
  });

  it('exposes the complete presentation flow and hides indoor working', () => {
    const schedule = getColonistSchedule(0);
    const at = (cycleTime: number) => (cycleTime - schedule.phaseOffset + schedule.cycleDuration) % schedule.cycleDuration;
    expect(getColonistPose(0, at(schedule.restDuration / 2))).toMatchObject({ state: 'resting', visible: true });
    expect(getColonistPose(0, at(schedule.restDuration + schedule.assignmentDuration / 2))).toMatchObject({ state: 'assigned', visible: true });
    expect(getColonistPose(0, at(schedule.restDuration + schedule.assignmentDuration + schedule.outboundDuration / 2))).toMatchObject({ animation: 'Walk', state: 'walking-to-facility', visible: true });
    expect(getColonistPose(0, at(schedule.restDuration + schedule.assignmentDuration + schedule.outboundDuration + schedule.workingDuration / 2))).toMatchObject({ state: 'working', visible: false });
    expect(getColonistPose(0, at(schedule.cycleDuration - schedule.inboundDuration / 2))).toMatchObject({ state: 'walking-to-habitat', visible: true });
  });

  it('builds deterministic schedules that are not one shared shifted template', () => {
    expect(getColonistSchedule(7)).toEqual(getColonistSchedule(7));
    const schedules = Array.from({ length: 12 }, (_, index) => getColonistSchedule(index));
    expect(new Set(schedules.map((schedule) => schedule.cycleDuration.toFixed(3))).size).toBeGreaterThan(8);
    expect(new Set(schedules.map((schedule) => schedule.restDuration.toFixed(3))).size).toBeGreaterThan(8);
  });

  it('derives travel duration from path distance and walking speed', () => {
    for (const index of [0, 4, 11, 23]) {
      const schedule = getColonistSchedule(index);
      expect(schedule.outboundDuration).toBeCloseTo(schedule.outboundDistance / schedule.walkingSpeed, 8);
      expect(schedule.inboundDuration).toBeCloseTo(schedule.inboundDistance / schedule.walkingSpeed, 8);
    }
  });

  it('distributes habitat rest slots and avoids a 50-colonist door pile', () => {
    const firstSixteen = Array.from({ length: 16 }, (_, index) => getColonistSchedule(index).restPointIndex);
    expect(new Set(firstSixteen)).toHaveLength(PROTOTYPE_LAYOUT.habitat.restPoints.length);
    const restingPositions = Array.from({ length: 50 }, (_, index) => getColonistPose(index, 0)).filter((pose) => pose.state === 'resting').map((pose) => `${pose.position[0].toFixed(2)}:${pose.position[2].toFixed(2)}`);
    const occupancy = new Map<string, number>();
    restingPositions.forEach((position) => occupancy.set(position, (occupancy.get(position) ?? 0) + 1));
    expect(Math.max(0, ...occupancy.values())).toBeLessThanOrEqual(2);
  });

  it('keeps the default 15-colonist scene visibly mixed', () => {
    const poses = Array.from({ length: 15 }, (_, index) => getColonistPose(index, 0));
    const states = new Set(poses.map((pose) => pose.state));
    expect(states.has('resting')).toBe(true);
    expect(states.has('walking-to-facility') || states.has('walking-to-habitat')).toBe(true);
    expect(poses.some((pose) => pose.state === 'working' && !pose.visible)).toBe(true);
  });

  it('validates the exact required character animation clips', () => {
    expect(validatePrototypeCharacterClips(PROTOTYPE_CHARACTER_ANIMATION_CLIPS)).toEqual([]);
    expect(validatePrototypeCharacterClips(['Idle'])).toEqual(['Walk']);
  });

  it('presents a routed maintenance cycle instead of spawning frozen at work', () => {
    for (const facility of ['reactor', 'mine'] as const) {
      const duration = getMaintenanceCycleDuration(facility);
      const poses = Array.from({ length: 120 }, (_, index) => getMaintenancePose(facility, duration * index / 119));
      expect(new Set(poses.map((pose) => pose.state))).toEqual(new Set(['resting', 'walking-to-facility', 'working', 'walking-to-habitat']));
      expect(poses.some((pose) => pose.state === 'working' && pose.activity && pose.animation === 'Idle')).toBe(true);
      expect(poses.some((pose) => pose.state === 'walking-to-facility' && pose.animation === 'Walk')).toBe(true);
    }
  });
});
