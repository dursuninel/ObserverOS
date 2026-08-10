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
  mapScreenDragToPanScalars,
  mapScreenDragToWorldPan,
  panScalarsToWorldOffset,
} from '../../src/game/world/prototype/cameraMath';
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
});
