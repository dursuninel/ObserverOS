import type { CameraPreset } from './types';
import type { CameraBounds, GeneratedPlanetLayout } from '../layout/layoutTypes';
import { COLONY_GROUND_CAMERA_BOUNDS, COLONY_GROUND_HALF_EXTENT } from '../layout/colonyGround';
import { getGeneratedFacility } from '../layout/layoutQueries';
import { getFacilityPlacement, PROTOTYPE_LAYOUT, type Point2 } from './prototypeLayout';

export interface CameraGroundBasis {
  readonly right: Point2;
  readonly up: Point2;
}

export interface CameraPanLimits {
  readonly right: number;
  readonly up: number;
}

export interface CameraPanScalars {
  readonly right: number;
  readonly up: number;
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

export function getCameraGroundBasis(cameraOffset: readonly [number, number, number] = CAMERA_OFFSET): CameraGroundBasis {
  const up = normalize(-cameraOffset[0], -cameraOffset[2]);
  return { right: normalize(-up[1], up[0]), up };
}

export function mapScreenDragToPanScalars(deltaX: number, deltaY: number, scale: number): CameraPanScalars {
  return { right: deltaX * scale, up: -deltaY * scale };
}

export function panScalarsToWorldOffset(scalars: CameraPanScalars, basis: CameraGroundBasis): Point2 {
  return [
    -basis.right[0] * scalars.right - basis.up[0] * scalars.up,
    -basis.right[1] * scalars.right - basis.up[1] * scalars.up,
  ];
}

export function mapScreenDragToWorldPan(deltaX: number, deltaY: number, scale: number, cameraOffset: readonly [number, number, number] = CAMERA_OFFSET): Point2 {
  return panScalarsToWorldOffset(mapScreenDragToPanScalars(deltaX, deltaY, scale), getCameraGroundBasis(cameraOffset));
}

export function mapScreenDragWithBasis(deltaX: number, deltaY: number, scale: number, cameraRight: Point2, cameraUpOnGround: Point2): Point2 {
  return panScalarsToWorldOffset(mapScreenDragToPanScalars(deltaX, deltaY, scale), { right: cameraRight, up: cameraUpOnGround });
}

const projectedHalfExtent = (axis: Point2, cameraBounds?: CameraBounds): number => {
  const world = cameraBounds ?? COLONY_GROUND_CAMERA_BOUNDS;
  const centerX = (world.minX + world.maxX) / 2;
  const centerZ = (world.minZ + world.maxZ) / 2;
  const corners: readonly Point2[] = [
    [world.minX, world.minZ], [world.minX, world.maxZ],
    [world.maxX, world.minZ], [world.maxX, world.maxZ],
  ];
  return Math.max(...corners.map(([x, z]) => Math.abs((x - centerX) * axis[0] + (z - centerZ) * axis[1])));
};

export function getCameraPanLimits(
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  panelOpen: boolean,
  basis: CameraGroundBasis = getCameraGroundBasis(),
  cameraBounds?: CameraBounds,
): CameraPanLimits {
  const mobile = viewportWidth <= 720;
  const safeWidth = Math.max(1, viewportWidth - (!mobile && panelOpen ? 360 : 0));
  const safeHeight = Math.max(1, viewportHeight * (mobile && panelOpen ? 0.62 : 1));
  const visibleRightHalf = safeWidth / (2 * Math.max(zoom, 1));
  const visibleUpHalf = safeHeight / (2 * Math.max(zoom, 1));
  const rightExtent = projectedHalfExtent(basis.right, cameraBounds);
  const upExtent = projectedHalfExtent(basis.up, cameraBounds);
  const overviewZoom = getCameraZoomRange(viewportWidth, panelOpen).overview;
  const zoomSensitiveCapRatio = Math.min(0.42, Math.max(0.22, 0.3 * zoom / overviewZoom));
  const limitFor = (extent: number, visibleHalf: number) => Math.min(
    extent * zoomSensitiveCapRatio,
    Math.max(extent * 0.12, extent - visibleHalf * 0.7),
  );
  return { right: limitFor(rightExtent, visibleRightHalf), up: limitFor(upExtent, visibleUpHalf) };
}

export function clampCameraPanScalars(scalars: CameraPanScalars, limits: CameraPanLimits): CameraPanScalars {
  return {
    right: Math.min(limits.right, Math.max(-limits.right, scalars.right)),
    up: Math.min(limits.up, Math.max(-limits.up, scalars.up)),
  };
}

export function clampCameraTargetInScreenSpace(
  target: Point2,
  origin: Point2,
  basis: CameraGroundBasis,
  limits: CameraPanLimits,
): Point2 {
  const offsetX = target[0] - origin[0];
  const offsetZ = target[1] - origin[1];
  const clamped = clampCameraPanScalars({
    right: -(offsetX * basis.right[0] + offsetZ * basis.right[1]),
    up: -(offsetX * basis.up[0] + offsetZ * basis.up[1]),
  }, limits);
  const worldOffset = panScalarsToWorldOffset(clamped, basis);
  return [origin[0] + worldOffset[0], origin[1] + worldOffset[1]];
}

/**
 * Zemin 44x44 → 36x36 küçüldüğü için yeniden kalibre edildi. `overview` artık ölçülen gerçek
 * genel-görünüm yakınlaştırmasına yakın (bkz. `getColonyGroundOverviewZoom`); `getCameraPanLimits`
 * kaydırma payını bu değere oranlıyor, uydurma bir 40/46 değil.
 * `min`, karenin köşeleriyle birlikte tamamının sığdığı yakınlaştırmanın biraz altında: kullanıcı
 * kareden biraz uzaklaşabilir ama boşlukta kaybolamaz.
 */
export function getCameraZoomRange(viewportWidth: number, panelOpen: boolean): CameraZoomRange {
  if (viewportWidth <= 720) return { min: 11, max: 68, overview: 20, focus: 54 };
  return { min: 18, max: 72, overview: panelOpen ? 30 : 34, focus: 56 };
}

/** İzometrik projeksiyonda karenin kenar ORTA noktaları (köşeler değil). */
const groundEdgeMidpoints: readonly Point2[] = [
  [COLONY_GROUND_HALF_EXTENT, 0], [-COLONY_GROUND_HALF_EXTENT, 0],
  [0, COLONY_GROUND_HALF_EXTENT], [0, -COLONY_GROUND_HALF_EXTENT],
];

/**
 * Genel görünüm yakınlaştırması SABİT zemin karesinden türetilir, adayın içeriğinden değil.
 *
 * Neden: `layout.cameraBounds` içerikten türetiliyor (öyle kalmalı, `layoutScoring.compactness`
 * ağırlık 3 ile ondan besleniyor). Kadrajı ona bağlamak her adayda farklı bir yakınlaştırma
 * veriyordu — aday değiştirince görüntü zıplıyordu. Zemin her adayda ve Default'ta aynı kare
 * olduğu için kadraj da aynı olmalı.
 *
 * Yatayda köşelerin taşmasına izin verilir: izometrik karenin sağ/sol köşeleri BOŞ üçgenlerdir,
 * onları kadraja sığdırmak kareyi gereksizce küçültür. Yatay ölçüt kenar orta noktaları, dikey
 * ölçüt karenin tam izdüşümüdür.
 */
export function getColonyGroundOverviewZoom(viewportWidth: number, viewportHeight: number, panelOpen: boolean): number {
  const mobile = viewportWidth <= 720;
  const safeWidth = Math.max(1, viewportWidth - (!mobile && panelOpen ? 380 : 0));
  const safeHeight = Math.max(1, viewportHeight * (mobile && panelOpen ? 0.62 : 1));
  const basis = getCameraGroundBasis();
  const groundVerticalScale = CAMERA_OFFSET[1] / Math.hypot(...CAMERA_OFFSET);
  const horizontalExtent = Math.max(...groundEdgeMidpoints.map(([x, z]) => Math.abs(x * basis.right[0] + z * basis.right[1])));
  const verticalExtent = projectedHalfExtent(basis.up, COLONY_GROUND_CAMERA_BOUNDS) * groundVerticalScale;
  const fitZoom = Math.min(safeWidth / (2 * horizontalExtent + 2.8), safeHeight / (2 * verticalExtent + 6.4)) * 0.94;
  return clampCameraZoom(fitZoom, getCameraZoomRange(viewportWidth, panelOpen));
}

export function clampCameraZoom(zoom: number, range: CameraZoomRange): number {
  return Math.min(range.max, Math.max(range.min, zoom));
}

export function getCameraPresetTarget(preset: CameraPreset, layout?: GeneratedPlanetLayout): readonly [number, number, number] {
  // Üretilen adaylarda genel görünüm ZEMİNİN merkezine bakar, adayın kendi `cameraBounds`
  // merkezine değil: o merkez adaydan adaya kayıyor ve kadrajı zıplatıyordu.
  if (preset === 'overview') return layout ? [COLONY_GROUND_CAMERA_BOUNDS.center[0], 0, COLONY_GROUND_CAMERA_BOUNDS.center[1]] : [PROTOTYPE_LAYOUT.camera.center[0], 0, PROTOTYPE_LAYOUT.camera.center[1]];
  const placement = layout ? getGeneratedFacility(layout, preset) : getFacilityPlacement(preset);
  return [placement.position[0], 0, placement.position[1]];
}
