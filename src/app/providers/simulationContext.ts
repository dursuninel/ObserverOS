import { createContext, useContext, useSyncExternalStore } from 'react';

import type { SimulationEngine } from '../../game/simulation/SimulationEngine';
import type { SimulationSnapshot } from '../../game/simulation/SimulationSnapshot';

export const SimulationContext = createContext<SimulationEngine | null>(null);

export function useSimulationEngine(): SimulationEngine {
  const engine = useContext(SimulationContext);
  if (engine === null) throw new Error('useSimulationEngine must be used inside SimulationProvider.');
  return engine;
}

export function useSimulationSnapshot(): SimulationSnapshot {
  const engine = useSimulationEngine();
  return useSyncExternalStore(
    (listener) => engine.subscribe(listener),
    () => engine.getSnapshot(),
    () => engine.getSnapshot(),
  );
}

