import type { SimulationSnapshot } from '../../simulation/SimulationSnapshot';

/** Presentation-only mapping; it cannot mutate or advance authoritative simulation state. */
export function simulationSnapshotToTimeOfDay(snapshot: SimulationSnapshot): number {
  return snapshot.time.cycleProgress;
}

