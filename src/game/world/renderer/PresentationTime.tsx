import { type PropsWithChildren, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';

import type { SimulationSpeed } from '../../simulation/SimulationClock';
import { PresentationClock } from '../presentation/PresentationClock';
import { PresentationTimeContext, usePresentationTimeContext } from './presentationTimeContext';

export function PresentationTimeProvider({ children, speed }: PropsWithChildren<{ readonly speed: SimulationSpeed }>) {
  const [clock] = useState(() => new PresentationClock());
  const value = useMemo(() => ({ clock, speed }), [clock, speed]);
  return <PresentationTimeContext.Provider value={value}>{children}</PresentationTimeContext.Provider>;
}

/** Runs before world presentation subscribers; negative priority keeps R3F auto-rendering enabled. */
export function PresentationTimeDriver() {
  const { clock, speed } = usePresentationTimeContext();
  useFrame((_, renderDeltaSeconds) => clock.advance(renderDeltaSeconds, speed), -100);
  return null;
}
