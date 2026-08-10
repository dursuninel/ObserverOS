export const SIMULATION_SPEEDS = [0, 1, 2, 4] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export interface SimulationClockConfig {
  readonly fixedStepMinutes: number;
  readonly localDayMinutes: number;
  readonly realSecondsPerSimulationHour: number;
}

export interface SimulationClockState {
  readonly accumulatorUnits: number;
  readonly elapsedMinutes: number;
  readonly speed: SimulationSpeed;
}

const MICROSECONDS_PER_MILLISECOND = 1_000;
const SIMULATION_MINUTES_PER_HOUR = 60;

export class SimulationClock {
  readonly config: SimulationClockConfig;
  private accumulatorUnits = 0;
  private elapsedMinutes = 0;
  private speed: SimulationSpeed;

  constructor(config: SimulationClockConfig, initialSpeed: SimulationSpeed = 1) {
    if (!Number.isInteger(config.fixedStepMinutes) || config.fixedStepMinutes <= 0) throw new Error('fixedStepMinutes must be a positive integer.');
    if (!Number.isInteger(config.localDayMinutes) || config.localDayMinutes <= 0) throw new Error('localDayMinutes must be a positive integer.');
    if (!Number.isFinite(config.realSecondsPerSimulationHour) || config.realSecondsPerSimulationHour <= 0) throw new Error('realSecondsPerSimulationHour must be positive.');
    this.config = Object.freeze({ ...config });
    this.speed = initialSpeed;
  }

  accumulateWallTime(wallMilliseconds: number): number {
    if (!Number.isFinite(wallMilliseconds) || wallMilliseconds < 0) throw new Error('wallMilliseconds must be finite and non-negative.');
    if (this.speed === 0 || wallMilliseconds === 0) return 0;

    const wallMicroseconds = Math.round(wallMilliseconds * MICROSECONDS_PER_MILLISECOND);
    this.accumulatorUnits += wallMicroseconds * this.speed * SIMULATION_MINUTES_PER_HOUR;
    const unitsPerStep = this.unitsPerStep();
    const dueSteps = Math.floor(this.accumulatorUnits / unitsPerStep);
    this.accumulatorUnits -= dueSteps * unitsPerStep;
    return dueSteps;
  }

  advanceFixedStep(): void {
    this.elapsedMinutes += this.config.fixedStepMinutes;
  }

  getElapsedMinutes(): number {
    return this.elapsedMinutes;
  }

  getLocalMinute(): number {
    return this.elapsedMinutes % this.config.localDayMinutes;
  }

  getSpeed(): SimulationSpeed {
    return this.speed;
  }

  setSpeed(speed: SimulationSpeed): void {
    if (!SIMULATION_SPEEDS.includes(speed)) throw new Error(`Unsupported simulation speed: ${speed}`);
    this.speed = speed;
  }

  exportState(): SimulationClockState {
    return Object.freeze({ accumulatorUnits: this.accumulatorUnits, elapsedMinutes: this.elapsedMinutes, speed: this.speed });
  }

  private unitsPerStep(): number {
    return this.config.realSecondsPerSimulationHour * 1_000_000 * this.config.fixedStepMinutes;
  }
}

