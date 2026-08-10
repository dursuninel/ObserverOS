import { type PropsWithChildren, useState } from 'react';

import { SimulationEngine } from '../../game/simulation/SimulationEngine';
import { SimulationContext } from './simulationContext';

export function SimulationProvider({ children, engine: suppliedEngine }: PropsWithChildren<{ readonly engine?: SimulationEngine }>) {
  const [engine] = useState(() => suppliedEngine ?? new SimulationEngine());
  return <SimulationContext.Provider value={engine}>{children}</SimulationContext.Provider>;
}

