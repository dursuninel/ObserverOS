import type { FacilityId, PrototypeDebugState, QualityProfileId } from './types';

export const DEFAULT_PROTOTYPE_STATE: PrototypeDebugState = {
  cameraPreset: 'overview',
  colonistCount: 15,
  fogEnabled: true,
  mineState: 'working',
  quality: 'high',
  reactorState: 'normal',
  safeAreasVisible: false,
  snowEnabled: true,
  timeOfDay: 0.74,
};

export const FACILITY_POSITIONS: Readonly<Record<FacilityId, readonly [number, number, number]>> = {
  reactor: [-5, 0.2, -2],
  solar: [-10, 0.18, 5],
  battery: [-1, 0.18, 5],
  mine: [9, 0.18, -5],
  habitat: [3, 0.18, -4],
  oxygen: [8, 0.18, 4],
};

export const QUALITY_PROFILES: Readonly<Record<QualityProfileId, { dpr: number; shadows: boolean; snowParticles: number; streetLights: number }>> = {
  low: { dpr: 1, shadows: false, snowParticles: 140, streetLights: 3 },
  medium: { dpr: 1.25, shadows: true, snowParticles: 280, streetLights: 5 },
  high: { dpr: 1.5, shadows: true, snowParticles: 480, streetLights: 7 },
};

export function isNight(timeOfDay: number): boolean {
  return timeOfDay < 0.22 || timeOfDay > 0.68;
}

export function getLampIntensity(timeOfDay: number): number {
  return isNight(timeOfDay) ? 2.4 : 0;
}

export function getFacilityVisualSignature(id: FacilityId, state: string, timeOfDay: number) {
  const night = isNight(timeOfDay);
  if (id === 'reactor') {
    const signatures = {
      boost: { color: '#8fe9ff', intensity: 3.2, speed: 2.2 },
      interlocked: { color: '#e8895c', intensity: 2.1, speed: 0 },
      maintenance: { color: '#f1c46e', intensity: 1.3, speed: 0.35 },
      normal: { color: '#66d7c2', intensity: 1.7, speed: 1 },
    } as const;
    return signatures[state as keyof typeof signatures] ?? signatures.normal;
  }
  if (id === 'mine') {
    const signatures = {
      maintenance: { color: '#f1c46e', intensity: 1.3, speed: 0.35 },
      offline: { color: '#53656b', intensity: 0.08, speed: 0 },
      working: { color: '#e7b66f', intensity: 1.4, speed: 1.3 },
    } as const;
    return signatures[state as keyof typeof signatures] ?? signatures.offline;
  }
  if (id === 'solar') return { color: night ? '#334950' : '#78bcd1', intensity: night ? 0.05 : 0.9, speed: 0 };
  if (id === 'battery') return { color: night ? '#efad62' : '#68cae4', intensity: 1.4, speed: night ? -1 : 1 };
  if (id === 'oxygen') return { color: '#70d7c5', intensity: 1.1, speed: 0.8 };
  return { color: night ? '#ffc374' : '#86c8d0', intensity: night ? 1.4 : 0.35, speed: 0 };
}

export function getSafeCameraTarget(target: readonly [number, number, number], viewportWidth: number, viewportHeight: number): readonly [number, number, number] {
  const isMobile = viewportWidth <= 720;
  const horizontalOffset = isMobile ? 0 : Math.min(3.2, (360 / Math.max(viewportWidth, 1)) * 8);
  const depthOffset = isMobile ? Math.min(2.8, (viewportHeight * 0.38 / Math.max(viewportHeight, 1)) * 6) : 0.7;
  return [target[0] + horizontalOffset, target[1], target[2] + depthOffset];
}
