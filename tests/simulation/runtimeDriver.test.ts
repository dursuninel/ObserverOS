import { describe, expect, it } from 'vitest';

import { BrowserSimulationDriver, type AnimationFrameScheduler } from '../../src/app/runtime/BrowserSimulationDriver';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';

class ManualFrameScheduler implements AnimationFrameScheduler {
  private callback: ((timestamp: number) => void) | null = null;
  private sequence = 0;

  cancel(): void {
    this.callback = null;
  }

  fire(timestamp: number): void {
    const callback = this.callback;
    if (callback === null) throw new Error('No frame is scheduled.');
    this.callback = null;
    callback(timestamp);
  }

  request(callback: (timestamp: number) => void): number {
    this.callback = callback;
    this.sequence += 1;
    return this.sequence;
  }
}

function runFrames(timestamps: readonly number[], speed: 0 | 1 | 2 | 4 = 1, catchUp = 100_000): SimulationEngine {
  const engine = new SimulationEngine();
  engine.setSpeed(speed);
  const scheduler = new ManualFrameScheduler();
  const driver = new BrowserSimulationDriver(engine, { maxCatchUpMillisecondsPerFrame: catchUp, scheduler });
  driver.start();
  for (const timestamp of timestamps) scheduler.fire(timestamp);
  driver.stop();
  return engine;
}

describe('BrowserSimulationDriver', () => {
  it('forwards browser frame deltas into the authoritative engine', () => {
    const driven = runFrames([0, 1_000]);
    const direct = new SimulationEngine();
    direct.advanceWallTime(1_000);
    expect(driven.serializeAuthoritativeState()).toBe(direct.serializeAuthoritativeState());
  });

  it('preserves authoritative results across 60 FPS, 30 FPS and irregular chunks', () => {
    const frames = (count: number, total: number) => Array.from({ length: count + 1 }, (_, index) => index * total / count);
    const irregularDeltas = [17, 41, 9, 83, 250, 11, 589];
    const irregular = [0];
    for (const delta of irregularDeltas) irregular.push((irregular.at(-1) ?? 0) + delta);
    const at60 = runFrames(frames(60, 1_000));
    const at30 = runFrames(frames(30, 1_000));
    const uneven = runFrames(irregular);
    expect(at60.serializeAuthoritativeState()).toBe(at30.serializeAuthoritativeState());
    expect(at60.serializeAuthoritativeState()).toBe(uneven.serializeAuthoritativeState());
  });

  it('produces no progression while runtime speed is Pause', () => {
    expect(runFrames([0, 25_000], 0).getSnapshot().time.elapsedMinutes).toBe(0);
  });

  it.each([[1, 60], [2, 120], [4, 240]] as const)('keeps x%s runtime progression at the canonical ratio', (speed, expected) => {
    expect(runFrames([0, 25_000], speed).getSnapshot().time.elapsedMinutes).toBe(expected);
  });

  it('retains large-delta backlog and drains it without dropping simulation time', () => {
    const engine = new SimulationEngine();
    const scheduler = new ManualFrameScheduler();
    const driver = new BrowserSimulationDriver(engine, { maxCatchUpMillisecondsPerFrame: 100, scheduler });
    driver.start();
    scheduler.fire(0);
    scheduler.fire(1_000);
    for (let index = 0; index < 9; index += 1) scheduler.fire(1_000);
    driver.stop();
    const direct = new SimulationEngine();
    direct.advanceWallTime(1_000);
    expect(engine.serializeAuthoritativeState()).toBe(direct.serializeAuthoritativeState());
  });

  it('advances authoritative day/night state through runtime deltas', () => {
    const engine = runFrames([0, 350_000], 1, 400_000);
    expect(engine.getSnapshot().time).toMatchObject({ dayIndex: 0, dayPhase: 'night', localMinute: 840 });
  });
});

