import { type PropsWithChildren, useEffect, useState } from 'react';

import { SimulationEngine } from '../../game/simulation/SimulationEngine';
import { BrowserSimulationDriver } from '../runtime/BrowserSimulationDriver';
import { SimulationContext } from './simulationContext';

export function SimulationProvider({ children, engine: suppliedEngine }: PropsWithChildren<{ readonly engine?: SimulationEngine }>) {
  const [engine] = useState(() => suppliedEngine ?? new SimulationEngine());
  useEffect(() => {
    const driver = new BrowserSimulationDriver(engine);
    driver.start();
    return () => driver.stop();
  }, [engine]);
  return <SimulationContext.Provider value={engine}>{children}</SimulationContext.Provider>;
}
