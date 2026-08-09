import { describe, expect, it } from 'vitest';

import type { SaveRepository } from '../../src/game/save/SaveRepository';
import { GameSession } from '../../src/game/session/GameSession';
import { SimulationEngine } from '../../src/game/simulation/SimulationEngine';

const saveRepository: SaveRepository = {
  read: () => Promise.resolve(null),
  write: () => Promise.resolve(),
};

describe('Phase 0 simulation shell', () => {
  it('instantiates without React or browser infrastructure', () => {
    const simulation = new SimulationEngine();

    expect(simulation.authority).toBe('simulation');
  });

  it('composes through GameSession without adding gameplay behavior', () => {
    const simulation = new SimulationEngine();
    const session = new GameSession({ saveRepository, simulation });

    expect(session.simulation).toBe(simulation);
    expect(session.saveRepository).toBe(saveRepository);
  });
});

