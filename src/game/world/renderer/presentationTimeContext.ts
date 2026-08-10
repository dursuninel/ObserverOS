import { createContext, useContext } from 'react';

import type { SimulationSpeed } from '../../simulation/SimulationClock';
import type { PresentationClock } from '../presentation/PresentationClock';

export interface PresentationTimeContextValue {
  readonly clock: PresentationClock;
  readonly speed: SimulationSpeed;
}

export const PresentationTimeContext = createContext<PresentationTimeContextValue | null>(null);

export function usePresentationTimeContext(): PresentationTimeContextValue {
  const value = useContext(PresentationTimeContext);
  if (value === null) throw new Error('Presentation time must be used inside PresentationTimeProvider.');
  return value;
}

export function usePresentationClock(): PresentationClock {
  return usePresentationTimeContext().clock;
}
