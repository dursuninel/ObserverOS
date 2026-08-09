import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdditiveBlending, MathUtils, Mesh, PointLight } from 'three';

import { requirePrototypeAsset } from '../assets/prototypeAssetRegistry';
import { getColonistPose } from '../prototype/navigation';
import { FACILITY_POSITIONS, getFacilityVisualSignature, getLampIntensity, isNight, QUALITY_PROFILES } from '../prototype/prototypeConfig';
import type { FacilityId, PrototypeDebugState, WorldMetrics } from '../prototype/types';
import { CameraRig } from './CameraRig';
import { RuntimeAsset } from './RuntimeAsset';

interface WorldSceneProps {
  readonly debugState: PrototypeDebugState;
  readonly onMetrics: (metrics: WorldMetrics) => void;
}

const EMPTY_METRICS: WorldMetrics = { drawCalls: 0, fps: 0, frameTimeMs: 0, geometryCount: 0, lightCount: 0, particleCount: 0, textureCount: 0, triangleCount: 0 };

function MetricsProbe({ onMetrics, particleCount }: { readonly onMetrics: (metrics: WorldMetrics) => void; readonly particleCount: number }) {
  const elapsed = useRef(0);
  const frames = useRef(0);
  const totalDelta = useRef(0);
  useFrame(({ gl, scene }, delta) => {
    elapsed.current += delta;
    totalDelta.current += delta;
    frames.current += 1;
    if (elapsed.current < 0.5) return;
    let lightCount = 0;
    scene.traverse((object) => { if (object instanceof PointLight) lightCount += 1; });
    onMetrics({
      drawCalls: gl.info.render.calls,
      fps: Math.round(frames.current / totalDelta.current),
      frameTimeMs: Math.round((totalDelta.current / frames.current) * 10000) / 10,
      geometryCount: gl.info.memory.geometries,
      lightCount,
      particleCount,
      textureCount: gl.info.memory.textures,
      triangleCount: gl.info.render.triangles,
    });
    elapsed.current = 0;
    frames.current = 0;
    totalDelta.current = 0;
  });
  return null;
}

function FacilityEffect({ color, height = 1.4, intensity, speed, position }: { readonly color: string; readonly height?: number; readonly intensity: number; readonly speed: number; readonly position: readonly [number, number, number] }) {
  const core = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!core.current) return;
    const pulse = speed === 0 ? 1 : 0.8 + Math.sin(clock.elapsedTime * speed * 3) * 0.18;
    core.current.scale.setScalar(pulse);
  });
  return (
    <group position={[position[0], position[1] + height, position[2]]}>
      <mesh ref={core}>
        <sphereGeometry args={[0.24, 14, 14]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.66, 0.045, 8, 28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 0.8} opacity={Math.min(0.9, 0.22 + intensity * 0.14)} transparent toneMapped={false} />
      </mesh>
      <pointLight color={color} distance={5} intensity={intensity * 0.45} />
    </group>
  );
}

function Facility({ id, debugState }: { readonly id: FacilityId; readonly debugState: PrototypeDebugState }) {
  const position = FACILITY_POSITIONS[id];
  const state = id === 'reactor' ? debugState.reactorState : id === 'mine' ? debugState.mineState : 'normal';
  const signature = getFacilityVisualSignature(id, state, debugState.timeOfDay);
  if (id === 'reactor') return <group><RuntimeAsset asset={requirePrototypeAsset('reactor-body')} position={position} /><RuntimeAsset asset={requirePrototypeAsset('reactor-tower')} position={position} /><FacilityEffect {...signature} height={4.25} position={position} /></group>;
  if (id === 'solar') return <group>{[[-1.8, 0, -0.6], [0, 0, -0.6], [1.8, 0, -0.6], [-0.9, 0, 0.8], [0.9, 0, 0.8]].map(([x, y, z], index) => <RuntimeAsset key={index} asset={requirePrototypeAsset('solar-panel')} position={[position[0] + (x ?? 0), position[1] + (y ?? 0), position[2] + (z ?? 0)]} />)}<FacilityEffect {...signature} position={position} /></group>;
  if (id === 'battery') return <group><RuntimeAsset asset={requirePrototypeAsset('battery-body')} position={position} /><RuntimeAsset asset={requirePrototypeAsset('battery-cargo')} position={position} /><FacilityEffect {...signature} position={position} /></group>;
  if (id === 'mine') return <group><RuntimeAsset asset={requirePrototypeAsset('mine-drill')} position={position} /><FacilityEffect {...signature} height={3.45} position={position} /></group>;
  if (id === 'habitat') return <group><RuntimeAsset asset={requirePrototypeAsset('habitat')} position={position} /><FacilityEffect {...signature} position={position} /></group>;
  return <group><RuntimeAsset asset={requirePrototypeAsset('oxygen')} position={position} /><RuntimeAsset asset={requirePrototypeAsset('oxygen-vent')} position={position} /><FacilityEffect {...signature} position={position} /></group>;
}

const roadPositions: readonly (readonly [number, number, number])[] = [
  [-8, 0, 1], [-4, 0, 1], [0, 0, 1], [4, 0, 1], [8, 0, 1], [12, 0, 1],
  [4, 0, -3], [8, 0, -3], [-4, 0, -3], [-8, 0, 5], [-4, 0, 5], [0, 0, 5], [4, 0, 5], [8, 0, 5],
];

const streetLightPositions: readonly (readonly [number, number, number])[] = [[-6, 0.2, 2.6], [-2, 0.2, -0.8], [2, 0.2, 2.6], [6, 0.2, -0.8], [10, 0.2, 2.6], [-8, 0.2, -1], [8, 0.2, 6]];

function StreetLights({ debugState }: { readonly debugState: PrototypeDebugState }) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const intensity = getLampIntensity(debugState.timeOfDay);
  return <>{streetLightPositions.slice(0, quality.streetLights).map((position, index) => <group key={index}><RuntimeAsset asset={requirePrototypeAsset('street-light')} position={position} rotationY={index % 2 ? Math.PI : 0} />{intensity > 0 && <pointLight castShadow={index < 2 && quality.shadows} color="#ffb664" distance={6} intensity={intensity} position={[position[0], position[1] + 1.7, position[2]]} />}</group>)}</>;
}

function Snow({ count }: { readonly count: number }) {
  const points = useRef<import('three').Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const seed = index * 16807 % 2147483647;
      values[index * 3] = ((seed % 1000) / 1000 - 0.5) * 35;
      values[index * 3 + 1] = 1 + ((seed * 17 % 1000) / 1000) * 14;
      values[index * 3 + 2] = ((seed * 31 % 1000) / 1000 - 0.5) * 30;
    }
    return values;
  }, [count]);
  useFrame((_, delta) => { if (points.current) points.current.rotation.y += delta * 0.015; });
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#e8f7ff" opacity={0.72} size={0.055} transparent depthWrite={false} blending={AdditiveBlending} /></points>;
}

function Colonist({ index }: { readonly index: number }) {
  const group = useRef<import('three').Group>(null);
  const pose = useRef(getColonistPose(index, 0));
  const [animation, setAnimation] = useState(() => getColonistPose(index, 0).animation);
  useFrame(({ clock }) => {
    pose.current = getColonistPose(index, clock.elapsedTime);
    setAnimation((current) => current === pose.current.animation ? current : pose.current.animation);
    if (!group.current) return;
    group.current.position.set(...pose.current.position);
    group.current.rotation.y = MathUtils.lerp(group.current.rotation.y, pose.current.rotationY, 0.14);
  });
  return <group ref={group} scale={0.78}><RuntimeAsset asset={requirePrototypeAsset('prototype-astronaut')} animation={animation} /></group>;
}

function MaintenanceWorker({ facility }: { readonly facility: 'mine' | 'reactor' }) {
  const [x, y, z] = FACILITY_POSITIONS[facility];
  const offset: readonly [number, number, number] = facility === 'reactor' ? [0, 0.2, 2.7] : [0, 0.2, 1.8];
  return (
    <group position={[x + offset[0], y + offset[1], z + offset[2]]} rotation-y={Math.PI} scale={0.82}>
      <RuntimeAsset animation="Weapon" asset={requirePrototypeAsset('prototype-astronaut')} />
      <pointLight color="#f1c46e" distance={2.5} intensity={1.2} position={[0, 1.2, 0]} />
    </group>
  );
}

const largePropPlacements: readonly { asset: 'rock-large' | 'rock-small-a' | 'rock-small-b'; position: readonly [number, number, number]; rotation: number; scale?: number }[] = [
  { asset: 'rock-large', position: [-14, 0.2, -7], rotation: 0.6 },
  { asset: 'rock-large', position: [15, 0.2, -9], rotation: 1.4, scale: 0.7 },
  { asset: 'rock-large', position: [-15, 0.2, 8], rotation: 2.1, scale: 0.55 },
  { asset: 'rock-small-a', position: [13, 0.2, -7], rotation: 0 },
  { asset: 'rock-small-b', position: [-13, 0.2, 8], rotation: 1.2 },
  { asset: 'rock-small-a', position: [-11, 0.2, -9], rotation: 2.4, scale: 1.3 },
  { asset: 'rock-small-b', position: [16, 0.2, 8], rotation: 0.8, scale: 1.2 },
  { asset: 'rock-small-a', position: [4, 0.2, -10], rotation: 1.7, scale: 1.1 },
  { asset: 'rock-small-b', position: [-5, 0.2, 10], rotation: 0.2, scale: 1.35 },
  { asset: 'rock-small-a', position: [18, 0.2, 1], rotation: 2.9 },
  { asset: 'rock-small-b', position: [-17, 0.2, 1], rotation: 1.5 },
  { asset: 'rock-small-a', position: [11, 0.2, 10], rotation: 0.5, scale: 1.25 },
];

const cratePlacements: readonly (readonly [number, number, number, number])[] = [
  [1.5, 0.2, -5.7, 0.4], [2.4, 0.2, -5.8, -0.3], [-7.5, 0.2, 6.6, 0.2], [-6.7, 0.2, 6.5, 1],
  [10.2, 0.2, -7.2, 0.7], [11, 0.2, -7.1, -0.2], [-2.5, 0.2, 7.5, 1.3], [-1.7, 0.2, 7.4, 0.1],
  [10.5, 0.2, 5.8, 0.8], [11.3, 0.2, 5.7, -0.6], [-6.4, 0.2, -4.8, 0.4], [-7.2, 0.2, -4.7, 1.4],
];

const floorLightPlacements: readonly (readonly [number, number, number])[] = [
  [-8, 0.22, 1], [-4, 0.22, 1], [0, 0.22, 1], [4, 0.22, 1], [8, 0.22, 1], [12, 0.22, 1],
  [-4, 0.22, 5], [0, 0.22, 5], [4, 0.22, 5], [8, 0.22, 5], [4, 0.22, -3], [8, 0.22, -3],
];

function WorldContent({ debugState, onMetrics }: WorldSceneProps) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const night = isNight(debugState.timeOfDay);
  const skyColor = night ? '#07101b' : '#9fb8c0';
  const ambient = night ? 0.72 : 1.45;
  return (
    <>
      <color attach="background" args={[skyColor]} />
      {debugState.fogEnabled && <fog attach="fog" args={[skyColor, night ? 24 : 28, night ? 55 : 58]} />}
      <ambientLight intensity={ambient} color={night ? '#6f87a8' : '#d7eef2'} />
      <directionalLight castShadow={quality.shadows} color={night ? '#86a1cd' : '#fff1d3'} intensity={night ? 1.05 : 2.4} position={[-12, 20, 10]} shadow-mapSize={[1024, 1024]} />
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[1, -0.05, 1]}><planeGeometry args={[42, 34]} /><meshStandardMaterial color={night ? '#93a7ad' : '#d7e5e7'} roughness={1} metalness={0} /></mesh>
      <Suspense fallback={null}>
        {roadPositions.map((position, index) => <RuntimeAsset key={index} asset={requirePrototypeAsset('road-tile')} position={position} />)}
        {(['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen'] as const).map((id) => <Facility key={id} id={id} debugState={debugState} />)}
        <RuntimeAsset asset={requirePrototypeAsset('expansion-pad')} position={[13, 0.12, 5]} />
        {largePropPlacements.map((placement, index) => <RuntimeAsset key={`large-${index}`} asset={requirePrototypeAsset(placement.asset)} position={placement.position} rotationY={placement.rotation} scaleMultiplier={placement.scale ?? 1} />)}
        {cratePlacements.map(([x, y, z, rotation], index) => <RuntimeAsset key={`crate-${index}`} asset={requirePrototypeAsset('supply-crate')} position={[x, y, z]} rotationY={rotation} />)}
        {floorLightPlacements.map((position, index) => <RuntimeAsset key={`floor-light-${index}`} asset={requirePrototypeAsset('floor-light')} position={position} />)}
        <StreetLights debugState={debugState} />
        {Array.from({ length: debugState.colonistCount }, (_, index) => <Colonist key={index} index={index} />)}
        {debugState.reactorState === 'maintenance' && <MaintenanceWorker facility="reactor" />}
        {debugState.mineState === 'maintenance' && <MaintenanceWorker facility="mine" />}
      </Suspense>
      {debugState.snowEnabled && <Snow count={quality.snowParticles} />}
      <MetricsProbe onMetrics={onMetrics} particleCount={debugState.snowEnabled ? quality.snowParticles : 0} />
      <CameraRig preset={debugState.cameraPreset} />
    </>
  );
}

export function WorldScene({ debugState, onMetrics }: WorldSceneProps) {
  const quality = QUALITY_PROFILES[debugState.quality];
  return (
    <div aria-label="Koloni görsel prototipi" className="world-scene-shell">
      <Canvas dpr={quality.dpr} orthographic camera={{ near: 0.1, far: 140, zoom: 23 }} shadows={quality.shadows} gl={{ antialias: debugState.quality !== 'low', powerPreference: 'high-performance' }}>
        <WorldContent debugState={debugState} onMetrics={onMetrics} />
      </Canvas>
    </div>
  );
}

export { EMPTY_METRICS };
