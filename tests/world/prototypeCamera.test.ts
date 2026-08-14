import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CAMERA_OFFSET,
  clampCameraPanScalars,
  clampCameraTargetInScreenSpace,
  clampCameraZoom,
  getCameraGroundBasis,
  getCameraPanLimits,
  getCameraPresetTarget,
  getCameraZoomRange,
  getColonyGroundOverviewZoom,
  mapScreenDragToPanScalars,
  mapScreenDragToWorldPan,
  panScalarsToWorldOffset,
} from '../../src/game/world/prototype/cameraMath';
import { COLONY_GROUND_HALF_EXTENT } from '../../src/game/world/layout/colonyGround';
import { generateLayoutCandidates } from '../../src/game/world/layout/layoutGenerator';
import { PROTOTYPE_LAYOUT } from '../../src/game/world/prototype/prototypeLayout';

describe('prototype camera math', () => {
  it('maps right and left drags as exact screen-space opposites', () => {
    const right = mapScreenDragToPanScalars(100, 0, 0.01);
    const left = mapScreenDragToPanScalars(-100, 0, 0.01);
    expect(right).toEqual({ right: 1, up: -0 });
    expect(left.right).toBe(-right.right);
    expect(left.up).toBeCloseTo(-right.up, 8);
  });

  it('maps up and down drags as exact screen-space opposites', () => {
    const up = mapScreenDragToPanScalars(0, -100, 0.01);
    const down = mapScreenDragToPanScalars(0, 100, 0.01);
    expect(up).toEqual({ right: 0, up: 1 });
    expect(down.right).toBeCloseTo(-up.right, 8);
    expect(down.up).toBe(-up.up);
  });

  it('keeps both scalar components for diagonal input', () => {
    expect(mapScreenDragToPanScalars(100, -100, 0.01)).toEqual({ right: 1, up: 1 });
  });

  it('has no gesture-angle discontinuity around the former 1.35 threshold', () => {
    const before = mapScreenDragToPanScalars(134.9, 100, 0.01);
    const after = mapScreenDragToPanScalars(135.1, 100, 0.01);
    expect(after.right - before.right).toBeCloseTo(0.002, 8);
    expect(after.up).toBe(before.up);
    expect(after.up).not.toBe(0);
  });

  it('projects pure horizontal and vertical drags onto the camera ground basis', () => {
    const basis = getCameraGroundBasis(CAMERA_OFFSET);
    const horizontal = mapScreenDragToWorldPan(100, 0, 0.01);
    const vertical = mapScreenDragToWorldPan(0, 100, 0.01);
    expect(horizontal[0] * basis.up[0] + horizontal[1] * basis.up[1]).toBeCloseTo(0, 8);
    expect(vertical[0] * basis.right[0] + vertical[1] * basis.right[1]).toBeCloseTo(0, 8);
  });

  it('derives symmetric screen-space bounds that respond to zoom', () => {
    const overview = getCameraPanLimits(1440, 900, 40, true);
    const zoomedIn = getCameraPanLimits(1440, 900, 64, true);
    expect(overview.right).toBeGreaterThan(0);
    expect(overview.up).toBeGreaterThan(0);
    expect(zoomedIn.right).toBeGreaterThan(overview.right);
    expect(zoomedIn.up).toBeGreaterThan(overview.up);
    expect(clampCameraPanScalars({ right: 999, up: -999 }, overview)).toEqual({ right: overview.right, up: -overview.up });
  });

  it('clamps screen axes independently without transferring movement', () => {
    const basis = getCameraGroundBasis();
    const origin = PROTOTYPE_LAYOUT.camera.center;
    const limits = { right: 2, up: 1 };
    expect(clampCameraPanScalars({ right: 5, up: 0.4 }, limits)).toEqual({ right: 2, up: 0.4 });
    const proposedOffset = panScalarsToWorldOffset({ right: 5, up: 0.4 }, basis);
    const target = clampCameraTargetInScreenSpace([origin[0] + proposedOffset[0], origin[1] + proposedOffset[1]], origin, basis, limits);
    const offset = [target[0] - origin[0], target[1] - origin[1]] as const;
    expect(-(offset[0] * basis.right[0] + offset[1] * basis.right[1])).toBeCloseTo(2, 8);
    expect(-(offset[0] * basis.up[0] + offset[1] * basis.up[1])).toBeCloseTo(0.4, 8);
  });

  it('resets overview and keeps readable desktop/mobile zoom clamps', () => {
    expect(getCameraPresetTarget('overview')).toEqual([PROTOTYPE_LAYOUT.camera.center[0], 0, PROTOTYPE_LAYOUT.camera.center[1]]);
    const desktop = getCameraZoomRange(1440, true);
    const mobile = getCameraZoomRange(390, true);
    expect(clampCameraZoom(1, desktop)).toBe(desktop.min);
    expect(clampCameraZoom(999, desktop)).toBe(desktop.max);
    expect(desktop.min).toBeGreaterThan(mobile.min);
  });

  it('derives overview zoom from the fixed ground square and the panel-safe viewport', () => {
    const open = getColonyGroundOverviewZoom(1440, 900, true);
    const closed = getColonyGroundOverviewZoom(1440, 900, false);
    expect(open).toBeGreaterThan(getCameraZoomRange(1440, true).min);
    expect(open).toBeLessThan(getCameraZoomRange(1440, true).max);
    // Panel açıkken güvenli genişlik daralır: kadraj hiçbir zaman daha yakın olamaz. (1440x900'de
    // ölçüt dikey olduğu için ikisi eşit çıkar; dar bir viewportta panel açıkken uzaklaşır.)
    expect(open).toBeLessThanOrEqual(closed);
    expect(getColonyGroundOverviewZoom(900, 900, true)).toBeLessThan(getColonyGroundOverviewZoom(900, 900, false));
    // Kare, kenar orta noktalarıyla güvenli alanın içinde kalır (köşelerin taşmasına izin var).
    const basis = getCameraGroundBasis();
    const horizontalExtent = COLONY_GROUND_HALF_EXTENT * Math.max(Math.abs(basis.right[0]), Math.abs(basis.right[1]));
    expect(2 * horizontalExtent * open).toBeLessThanOrEqual(1440 - 380);
  });

  it('frames every candidate on the ground centre — kadraj aday değişiminde zıplamaz', () => {
    const result = generateLayoutCandidates({ seed: 41_001 });
    if (result.status !== 'success') throw new Error(`seed 41001 üretilemedi: ${result.reasons.join(', ')}`);
    expect(result.candidates.length).toBeGreaterThanOrEqual(5);
    // Adayların KENDİ `cameraBounds` merkezleri birbirinden farklı — kadraj onlara bağlansaydı zıplardı.
    const ownCentres = new Set(result.candidates.map((candidate) => candidate.cameraBounds.center.join(':')));
    expect(ownCentres.size).toBeGreaterThan(1);
    for (const candidate of result.candidates) expect(getCameraPresetTarget('overview', candidate)).toEqual([0, 0, 0]);
  });

  it('keeps CameraRig off per-candidate bounds for framing', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/game/world/renderer/CameraRig.tsx'), 'utf8');
    expect(source).toContain('getColonyGroundOverviewZoom(size.width, size.height, panelOpen)');
    expect(source).not.toContain('layout?.cameraBounds');
    expect(source).not.toContain('cameraBounds)');
  });
});
