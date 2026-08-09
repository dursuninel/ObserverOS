/**
 * Authoritative simulation composition root.
 * Gameplay systems are intentionally deferred beyond Phase 0.
 */
export class SimulationEngine {
  readonly authority = 'simulation' as const;
}

