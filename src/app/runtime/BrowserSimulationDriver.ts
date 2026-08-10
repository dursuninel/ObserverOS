import type { SimulationEngine } from '../../game/simulation/SimulationEngine';

export interface AnimationFrameScheduler {
  cancel(frameId: number): void;
  request(callback: (timestamp: number) => void): number;
}

export interface BrowserSimulationDriverOptions {
  readonly maxCatchUpMillisecondsPerFrame?: number;
  readonly scheduler?: AnimationFrameScheduler;
}

const DEFAULT_MAX_CATCH_UP_MILLISECONDS = 1_000;

function browserScheduler(): AnimationFrameScheduler {
  return {
    cancel: (frameId) => cancelAnimationFrame(frameId),
    request: (callback) => requestAnimationFrame(callback),
  };
}

/** Thin browser adapter: it supplies wall-time deltas but owns no simulation state or rules. */
export class BrowserSimulationDriver {
  private frameId: number | null = null;
  private readonly maxCatchUpMillisecondsPerFrame: number;
  private observedWallMicroseconds = 0;
  private originTimestamp: number | null = null;
  private pendingWallMicroseconds = 0;
  private readonly scheduler: AnimationFrameScheduler;

  constructor(private readonly engine: SimulationEngine, options: BrowserSimulationDriverOptions = {}) {
    this.scheduler = options.scheduler ?? browserScheduler();
    this.maxCatchUpMillisecondsPerFrame = options.maxCatchUpMillisecondsPerFrame ?? DEFAULT_MAX_CATCH_UP_MILLISECONDS;
    if (!Number.isFinite(this.maxCatchUpMillisecondsPerFrame) || this.maxCatchUpMillisecondsPerFrame <= 0) {
      throw new Error('maxCatchUpMillisecondsPerFrame must be finite and positive.');
    }
  }

  start(): void {
    if (this.frameId !== null) return;
    this.frameId = this.scheduler.request(this.onFrame);
  }

  stop(): void {
    if (this.frameId !== null) this.scheduler.cancel(this.frameId);
    this.frameId = null;
    this.observedWallMicroseconds = 0;
    this.originTimestamp = null;
    this.pendingWallMicroseconds = 0;
  }

  private readonly onFrame = (timestamp: number): void => {
    this.frameId = null;
    if (this.originTimestamp === null) {
      this.originTimestamp = timestamp;
    } else {
      const totalObservedMicroseconds = Math.max(0, Math.round((timestamp - this.originTimestamp) * 1_000));
      this.pendingWallMicroseconds += Math.max(0, totalObservedMicroseconds - this.observedWallMicroseconds);
      this.observedWallMicroseconds = Math.max(this.observedWallMicroseconds, totalObservedMicroseconds);
      const catchUpLimitMicroseconds = this.maxCatchUpMillisecondsPerFrame * 1_000;
      const deliveredMicroseconds = Math.min(this.pendingWallMicroseconds, catchUpLimitMicroseconds);
      if (deliveredMicroseconds > 0) {
        this.engine.advanceWallTime(deliveredMicroseconds / 1_000);
        this.pendingWallMicroseconds -= deliveredMicroseconds;
      }
    }
    this.frameId = this.scheduler.request(this.onFrame);
  };
}
