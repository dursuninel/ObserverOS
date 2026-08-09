import type { SaveRepository } from '../save/SaveRepository';
import type { SimulationEngine } from '../simulation/SimulationEngine';

export interface GameSessionDependencies {
  readonly saveRepository: SaveRepository;
  readonly simulation: SimulationEngine;
}

/** Composition boundary for an active simulation and its infrastructure ports. */
export class GameSession {
  readonly saveRepository: SaveRepository;
  readonly simulation: SimulationEngine;

  constructor(dependencies: GameSessionDependencies) {
    this.simulation = dependencies.simulation;
    this.saveRepository = dependencies.saveRepository;
  }
}

