import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, OrthographicCamera, Vector3 } from 'three';

import { getSafeCameraTarget } from '../prototype/prototypeConfig';
import { getFacilityPlacement, PROTOTYPE_LAYOUT } from '../prototype/prototypeLayout';
import type { CameraPreset } from '../prototype/types';

const PRESET_TARGETS: Record<CameraPreset, readonly [number, number, number]> = {
  overview: [PROTOTYPE_LAYOUT.camera.center[0], 0, PROTOTYPE_LAYOUT.camera.center[1]],
  reactor: [getFacilityPlacement('reactor').position[0], 0, getFacilityPlacement('reactor').position[1]],
  mine: [getFacilityPlacement('mine').position[0], 0, getFacilityPlacement('mine').position[1]],
  habitat: [getFacilityPlacement('habitat').position[0], 0, getFacilityPlacement('habitat').position[1]],
};

export function CameraRig({ panelOpen, preset }: { readonly panelOpen: boolean; readonly preset: CameraPreset }) {
  const { camera, gl, size } = useThree();
  const target = useRef(new Vector3(...PRESET_TARGETS.overview));
  const destination = useRef(new Vector3(...PRESET_TARGETS.overview));
  const desiredZoom = useRef(23);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const previousPinchDistance = useRef<number | null>(null);

  useEffect(() => {
    const safeTarget = getSafeCameraTarget(PRESET_TARGETS[preset], size.width, size.height, panelOpen);
    destination.current.set(...safeTarget);
    desiredZoom.current = preset === 'overview' ? (size.width <= 720 ? 24 : panelOpen ? 40 : 46) : 48;
  }, [panelOpen, preset, size.height, size.width]);

  useEffect(() => {
    const element = gl.domElement;
    const onPointerDown = (event: PointerEvent) => {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
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
        if (previousPinchDistance.current) desiredZoom.current = MathUtils.clamp(desiredZoom.current * distance / previousPinchDistance.current, 14, 82);
        previousPinchDistance.current = distance;
        return;
      }
      const zoom = camera instanceof OrthographicCamera ? camera.zoom : 45;
      const scale = 0.012 * (45 / zoom);
      destination.current.x -= (event.clientX - previous.x) * scale;
      destination.current.z -= (event.clientY - previous.y) * scale;
    };
    const onPointerUp = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      previousPinchDistance.current = null;
    };
    const onWheel = (event: WheelEvent) => {
      if (!(camera instanceof OrthographicCamera)) return;
      event.preventDefault();
      desiredZoom.current = MathUtils.clamp(desiredZoom.current * (event.deltaY > 0 ? 0.9 : 1.1), 14, 82);
    };
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('wheel', onWheel);
    };
  }, [camera, gl]);

  /* eslint-disable react-hooks/immutability -- R3F camera transforms are intentionally imperative inside the render loop. */
  useFrame(() => {
    target.current.lerp(destination.current, 0.08);
    if (camera instanceof OrthographicCamera) {
      camera.zoom = MathUtils.lerp(camera.zoom, desiredZoom.current, 0.12);
      camera.updateProjectionMatrix();
    }
    camera.position.set(target.current.x + 16, 17, target.current.z + 19);
    camera.lookAt(target.current);
  });
  /* eslint-enable react-hooks/immutability */

  return null;
}
