import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, OrthographicCamera, Vector3 } from 'three';

import { CAMERA_OFFSET, clampCameraTargetInScreenSpace, clampCameraZoom, getCameraPanLimits, getCameraPresetTarget, getCameraZoomRange, mapScreenDragWithBasis } from '../prototype/cameraMath';
import { getSafeCameraTarget } from '../prototype/prototypeConfig';
import type { CameraPreset } from '../prototype/types';
import type { GeneratedPlanetLayout } from '../layout/layoutTypes';

export function CameraRig({ layout, panelOpen, preset, resetToken }: { readonly layout: GeneratedPlanetLayout; readonly panelOpen: boolean; readonly preset: CameraPreset; readonly resetToken: number }) {
  const { camera, gl, size } = useThree();
  const target = useRef(new Vector3(...getCameraPresetTarget('overview', layout)));
  const destination = useRef(new Vector3(...getCameraPresetTarget('overview', layout)));
  const desiredZoom = useRef(40);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const previousPinchDistance = useRef<number | null>(null);
  const cameraRight = useRef(new Vector3());
  const cameraUpOnGround = useRef(new Vector3());
  const panOrigin = useRef<{ x: number; y: number } | null>(null);
  const panStartTarget = useRef(new Vector3());
  const panClampOrigin = useRef(new Vector3());

  useEffect(() => {
    const safeTarget = getSafeCameraTarget(getCameraPresetTarget(preset, layout), size.width, size.height, panelOpen);
    const range = getCameraZoomRange(size.width, panelOpen);
    target.current.set(...safeTarget);
    destination.current.set(...safeTarget);
    panClampOrigin.current.set(...safeTarget);
    desiredZoom.current = preset === 'overview' ? range.overview : range.focus;
  }, [layout, panelOpen, preset, resetToken, size.height, size.width]);

  useEffect(() => {
    const element = gl.domElement;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') pointers.current.clear();
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 1) {
        panOrigin.current = { x: event.clientX, y: event.clientY };
        panStartTarget.current.copy(destination.current);
      }
      element.setPointerCapture(event.pointerId);
      if (pointers.current.size === 2) {
        const [first, second] = [...pointers.current.values()];
        if (first && second) previousPinchDistance.current = Math.hypot(second.x - first.x, second.y - first.y);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size >= 2) {
        const [first, second] = [...pointers.current.values()];
        if (!first || !second) return;
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        if (previousPinchDistance.current) desiredZoom.current = clampCameraZoom(desiredZoom.current * distance / previousPinchDistance.current, getCameraZoomRange(size.width, panelOpen));
        previousPinchDistance.current = distance;
        return;
      }
      const zoom = camera instanceof OrthographicCamera ? camera.zoom : 45;
      const scale = 0.012 * (45 / zoom);
      camera.updateMatrixWorld();
      cameraRight.current.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      cameraUpOnGround.current.setFromMatrixColumn(camera.matrixWorld, 1).setY(0).normalize();
      const totalX = event.clientX - (panOrigin.current?.x ?? previous.x);
      const totalY = event.clientY - (panOrigin.current?.y ?? previous.y);
      const [panX, panZ] = mapScreenDragWithBasis(
        totalX, totalY, scale,
        [cameraRight.current.x, cameraRight.current.z], [cameraUpOnGround.current.x, cameraUpOnGround.current.z],
      );
      const basis = {
        right: [cameraRight.current.x, cameraRight.current.z] as const,
        up: [cameraUpOnGround.current.x, cameraUpOnGround.current.z] as const,
      };
      const limits = getCameraPanLimits(size.width, size.height, zoom, panelOpen, basis, layout.cameraBounds);
      const [clampedX, clampedZ] = clampCameraTargetInScreenSpace(
        [panStartTarget.current.x + panX, panStartTarget.current.z + panZ],
        [panClampOrigin.current.x, panClampOrigin.current.z],
        basis,
        limits,
      );
      destination.current.x = clampedX;
      destination.current.z = clampedZ;
    };
    const onPointerUp = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      previousPinchDistance.current = null;
      panOrigin.current = null;
    };
    const onWheel = (event: WheelEvent) => {
      if (!(camera instanceof OrthographicCamera)) return;
      event.preventDefault();
      desiredZoom.current = clampCameraZoom(desiredZoom.current * (event.deltaY > 0 ? 0.9 : 1.1), getCameraZoomRange(size.width, panelOpen));
    };
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('lostpointercapture', onPointerUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('lostpointercapture', onPointerUp);
      element.removeEventListener('wheel', onWheel);
    };
  }, [camera, gl, layout.cameraBounds, panelOpen, size.height, size.width]);

  /* eslint-disable react-hooks/immutability -- R3F camera transforms are intentionally imperative inside the render loop. */
  useFrame(() => {
    target.current.lerp(destination.current, 0.08);
    if (camera instanceof OrthographicCamera) {
      camera.zoom = MathUtils.lerp(camera.zoom, desiredZoom.current, 0.12);
      camera.updateProjectionMatrix();
    }
    camera.position.set(target.current.x + CAMERA_OFFSET[0], CAMERA_OFFSET[1], target.current.z + CAMERA_OFFSET[2]);
    camera.lookAt(target.current);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
