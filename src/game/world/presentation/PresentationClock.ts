import type { SimulationSpeed } from '../../simulation/SimulationClock';

/**
 * Presentation-only clock. It scales visual progression with authoritative
 * simulation speed but never advances or predicts gameplay state.
 */
export class PresentationClock {
  private deltaSeconds = 0;
  private elapsedSeconds = 0;

  advance(renderDeltaSeconds: number, simulationSpeed: SimulationSpeed): void {
    if (!Number.isFinite(renderDeltaSeconds) || renderDeltaSeconds < 0) {
      throw new Error('renderDeltaSeconds must be finite and non-negative.');
    }
    this.deltaSeconds = renderDeltaSeconds * simulationSpeed;
    this.elapsedSeconds += this.deltaSeconds;
  }

  getDeltaSeconds(): number {
    return this.deltaSeconds;
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }
}

export function getFacilityActivityScale(activitySpeed: number, elapsedSeconds: number): number {
  return activitySpeed === 0 ? 1 : 0.9 + Math.sin(elapsedSeconds * activitySpeed * 2.4) * 0.08;
}

export function getHazePosition(
  anchor: readonly [number, number],
  index: number,
  elapsedSeconds: number,
): readonly [number, number] {
  return [
    anchor[0] + Math.sin(elapsedSeconds * (0.035 + index * 0.004) + index) * 0.8,
    anchor[1] + Math.cos(elapsedSeconds * (0.028 + index * 0.003) + index) * 0.45,
  ];
}

export function isMaintenanceActivityPulse(elapsedSeconds: number): boolean {
  return Math.sin(elapsedSeconds * 5.2) > 0.72;
}
