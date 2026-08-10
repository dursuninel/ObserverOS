import { describe, expect, it } from 'vitest';

import { CAMERA_OFFSET, clampCameraTarget, clampCameraZoom, getCameraPanBounds, getCameraPresetTarget, getCameraZoomRange, mapScreenDragToWorldPan } from '../../src/game/world/prototype/cameraMath';
import { PROTOTYPE_LAYOUT } from '../../src/game/world/prototype/prototypeLayout';

const normalize = (x: number, z: number): readonly [number, number] => {
  const length = Math.hypot(x, z);
  return [x / length, z / length];
};

describe('prototype camera math', () => {
  it('maps horizontal and vertical screen drags without diagonal screen drift', () => {
    const forward = normalize(-CAMERA_OFFSET[0], -CAMERA_OFFSET[2]);
    const right = normalize(-forward[1], forward[0]);
    const horizontal = mapScreenDragToWorldPan(100, 0, 0.01);
    const vertical = mapScreenDragToWorldPan(0, 100, 0.01);
    expect(horizontal[0] * forward[0] + horizontal[1] * forward[1]).toBeCloseTo(0, 8);
    expect(vertical[0] * right[0] + vertical[1] * right[1]).toBeCloseTo(0, 8);
    expect(horizontal[0] * right[0] + horizontal[1] * right[1]).toBeLessThan(0);
    expect(vertical[0] * forward[0] + vertical[1] * forward[1]).toBeGreaterThan(0);
  });

  it('clamps pan targets to layout-derived bounds', () => {
    const bounds = getCameraPanBounds();
    expect(clampCameraTarget([-999, 999], bounds)).toEqual([bounds.minX, bounds.maxZ]);
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxZ).toBeGreaterThan(bounds.minZ);
  });

  it('resets overview to the canonical layout center', () => {
    expect(getCameraPresetTarget('overview')).toEqual([PROTOTYPE_LAYOUT.camera.center[0], 0, PROTOTYPE_LAYOUT.camera.center[1]]);
  });

  it('uses readable desktop/mobile zoom clamps', () => {
    const desktop = getCameraZoomRange(1440, true);
    const mobile = getCameraZoomRange(390, true);
    expect(clampCameraZoom(1, desktop)).toBe(desktop.min);
    expect(clampCameraZoom(999, desktop)).toBe(desktop.max);
    expect(desktop.min).toBeGreaterThan(mobile.min);
    expect(desktop.overview).toBeGreaterThan(desktop.min);
  });
});
