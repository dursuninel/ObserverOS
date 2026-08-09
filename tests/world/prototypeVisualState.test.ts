import { describe, expect, it } from 'vitest';

import { getFacilityVisualSignature, getLampIntensity, getSafeCameraTarget, isNight, QUALITY_PROFILES } from '../../src/game/world/prototype/prototypeConfig';

describe('prototype visual state mappings', () => {
  it('maps all reactor states to visibly distinct signatures', () => {
    const states = ['normal', 'boost', 'interlocked', 'maintenance'] as const;
    const signatures = states.map((state) => getFacilityVisualSignature('reactor', state, 0.5));
    expect(new Set(signatures.map(({ color, intensity, speed }) => `${color}-${intensity}-${speed}`)).size).toBe(states.length);
  });

  it('maps working, offline, and maintenance mine states distinctly', () => {
    const states = ['working', 'offline', 'maintenance'] as const;
    const signatures = states.map((state) => getFacilityVisualSignature('mine', state, 0.5));
    expect(new Set(signatures.map(({ color, intensity, speed }) => `${color}-${intensity}-${speed}`)).size).toBe(states.length);
    expect(signatures[1]?.speed).toBe(0);
  });

  it('turns warm street lamps on only at night', () => {
    expect(isNight(0.74)).toBe(true);
    expect(getLampIntensity(0.74)).toBeGreaterThan(0);
    expect(getLampIntensity(0.5)).toBe(0);
  });

  it('defines bounded quality profiles and safe camera offsets', () => {
    expect(QUALITY_PROFILES.low.snowParticles).toBeLessThan(QUALITY_PROFILES.high.snowParticles);
    expect(getSafeCameraTarget([2, 0, 3], 1440, 900)[0]).toBeGreaterThan(2);
    expect(getSafeCameraTarget([2, 0, 3], 390, 844)[2]).toBeGreaterThan(3);
  });
});
