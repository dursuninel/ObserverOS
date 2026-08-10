import { describe, expect, it } from 'vitest';

import { SimulationClock, type SimulationSpeed } from '../../src/game/simulation/SimulationClock';

const clockConfig = { fixedStepMinutes: 1, localDayMinutes: 1_440, realSecondsPerSimulationHour: 25 } as const;

function runChunks(chunks: readonly number[], speed: SimulationSpeed = 1): SimulationClock {
  const clock = new SimulationClock(clockConfig, speed);
  for (const chunk of chunks) {
    const steps = clock.accumulateWallTime(chunk);
    for (let index = 0; index < steps; index += 1) clock.advanceFixedStep();
  }
  return clock;
}

describe('SimulationClock', () => {
  it('converts the canonical rate to integer simulation minutes', () => {
    const clock = runChunks([25_000]);
    expect(clock.getElapsedMinutes()).toBe(60);
    expect(clock.getLocalMinute()).toBe(60);
  });

  it('is invariant to wall-time frame chunking', () => {
    const smallFrames = runChunks(Array.from({ length: 100 }, () => 10));
    const largeFrames = runChunks(Array.from({ length: 10 }, () => 100));
    expect(smallFrames.exportState()).toEqual(largeFrames.exportState());
  });

  it('discards paused wall time without authoritative progression or backlog', () => {
    const clock = new SimulationClock(clockConfig, 0);
    expect(clock.accumulateWallTime(25_000)).toBe(0);
    expect(clock.exportState()).toEqual({ accumulatorUnits: 0, elapsedMinutes: 0, speed: 0 });
  });

  it.each([[1, 60], [2, 120], [4, 240]] as const)('applies x%s as real simulation speed', (speed, expectedMinutes) => {
    expect(runChunks([25_000], speed).getElapsedMinutes()).toBe(expectedMinutes);
  });

  it('keeps speed changes deterministic including partial fixed steps', () => {
    const run = () => {
      const clock = new SimulationClock(clockConfig, 1);
      for (const [milliseconds, speed] of [[200, 1], [200, 2], [200, 4], [200, 0], [200, 1]] as const) {
        clock.setSpeed(speed);
        const steps = clock.accumulateWallTime(milliseconds);
        for (let index = 0; index < steps; index += 1) clock.advanceFixedStep();
      }
      return clock.exportState();
    };
    expect(run()).toEqual(run());
  });
});

