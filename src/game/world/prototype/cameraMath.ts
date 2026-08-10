import type { CameraPreset } from './types';
import { getFacilityPlacement, getPrototypeWorldBounds, PROTOTYPE_LAYOUT, type Point2 } from './prototypeLayout';

export interface CameraBounds {
  readonly maxX: number;
  readonly maxZ: number;
  readonly minX: number;
  readonly minZ: number;
}

export interface CameraZoomRange {
  readonly focus: number;
  readonly max: number;
  readonly min: number;
  readonly overview: number;
}

export const CAMERA_OFFSET = [16, 17, 19] as const;

const normalize = (x: number, z: number): Point2 => {
  const length = Math.max(0.0001, Math.hypot(x, z));
  return [x / length, z / length];
};

export function mapScreenDragToWorldPan(deltaX: number, deltaY: number, scale: number, cameraOffset: readonly [number, number, number] = CAMERA_OFFSET): Point2 {
  const forward = normalize(-cameraOffset[0], -cameraOffset[2]);
  const right = normalize(-forward[1], forward[0]);
  return mapScreenDragWithBasis(deltaX, deltaY, scale, right, forward);
}

export function mapScreenDragWithBasis(deltaX: number, deltaY: number, scale: number, cameraRight: Point2, cameraUpOnGround: Point2): Point2 {
  return [(-cameraRight[0] * deltaX + cameraUpOnGround[0] * deltaY) * scale, (-cameraRight[1] * deltaX + cameraUpOnGround[1] * deltaY) * scale];
}

export function getCameraPanBounds(): CameraBounds {
  const world = getPrototypeWorldBounds();
  const centerX = (world.minX + world.maxX) / 2;
  const centerZ = (world.minZ + world.maxZ) / 2;
  const halfX = (world.maxX - world.minX) * 0.18;
  const halfZ = (world.maxZ - world.minZ) * 0.16;
  return { minX: centerX - halfX, maxX: centerX + halfX, minZ: centerZ - halfZ, maxZ: centerZ + halfZ };
}

export function clampCameraTarget(target: Point2, bounds: CameraBounds = getCameraPanBounds()): Point2 {
  return [Math.min(bounds.maxX, Math.max(bounds.minX, target[0])), Math.min(bounds.maxZ, Math.max(bounds.minZ, target[1]))];
}

export function getCameraZoomRange(viewportWidth: number, panelOpen: boolean): CameraZoomRange {
  if (viewportWidth <= 720) return { min: 20, max: 68, overview: 24, focus: 54 };
  return { min: 28, max: 72, overview: panelOpen ? 40 : 46, focus: 56 };
}

export function clampCameraZoom(zoom: number, range: CameraZoomRange): number {
  return Math.min(range.max, Math.max(range.min, zoom));
}

export function getCameraPresetTarget(preset: CameraPreset): readonly [number, number, number] {
  if (preset === 'overview') return [PROTOTYPE_LAYOUT.camera.center[0], 0, PROTOTYPE_LAYOUT.camera.center[1]];
  const placement = getFacilityPlacement(preset);
  return [placement.position[0], 0, placement.position[1]];
}
