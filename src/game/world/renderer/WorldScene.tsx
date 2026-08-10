import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdditiveBlending, MathUtils, Mesh, PointLight } from 'three';

import { requirePrototypeAsset } from '../assets/prototypeAssetRegistry';
import { getColonistPose } from '../prototype/navigation';
import { getFacilityVisualSignature, getLampIntensity, isNight, QUALITY_PROFILES } from '../prototype/prototypeConfig';
import { getFacilityPlacement, getFacilityWorkPoint, getRoadTilePlacements, getStreetLightPlacements, PROTOTYPE_LAYOUT } from '../prototype/prototypeLayout';
import type { FacilityId, PrototypeDebugState, WorldMetrics } from '../prototype/types';
import { CameraRig } from './CameraRig';
import { RuntimeAsset } from './RuntimeAsset';

interface WorldSceneProps {
  readonly debugPanelOpen: boolean;
  readonly debugState: PrototypeDebugState;
  readonly onMetrics: (metrics: WorldMetrics) => void;
}

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

function FacilityActivity({ color, height, intensity, speed }: { readonly color: string; readonly height: number; readonly intensity: number; readonly speed: number }) {
  const indicator = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!indicator.current) return;
    const pulse = speed === 0 ? 1 : 0.9 + Math.sin(clock.elapsedTime * speed * 2.4) * 0.08;
    indicator.current.scale.setScalar(pulse);
  });
  return (
    <group position={[0, height, 0]}>
      <mesh ref={indicator}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity * 0.75} toneMapped={false} />
      </mesh>
      {intensity > 0.2 && <pointLight color={color} distance={3.2} intensity={intensity * 0.2} />}
    </group>
  );
}

function Facility({ debugState, id }: { readonly debugState: PrototypeDebugState; readonly id: FacilityId }) {
  const placement = getFacilityPlacement(id);
  const state = id === 'reactor' ? debugState.reactorState : id === 'mine' ? debugState.mineState : 'normal';
  const signature = getFacilityVisualSignature(id, state, debugState.timeOfDay);
  const groupProps = { position: [placement.position[0], 0.18, placement.position[1]] as const, rotation: [0, placement.rotationY, 0] as const };
  if (id === 'reactor') return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('reactor-body')} /><RuntimeAsset asset={requirePrototypeAsset('reactor-tower')} /><FacilityActivity {...signature} height={3.75} /></group>;
  if (id === 'solar') return <group {...groupProps}>{[[-1.8, 0, -0.55], [0, 0, -0.55], [1.8, 0, -0.55], [-0.9, 0, 0.7], [0.9, 0, 0.7]].map(([x, y, z], index) => <RuntimeAsset key={index} asset={requirePrototypeAsset('solar-panel')} position={[x ?? 0, y ?? 0, z ?? 0]} />)}<FacilityActivity {...signature} height={0.45} /></group>;
  if (id === 'battery') return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('battery-body')} /><RuntimeAsset asset={requirePrototypeAsset('battery-cargo')} /><FacilityActivity {...signature} height={1.65} /></group>;
  if (id === 'mine') return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('mine-drill')} /><FacilityActivity {...signature} height={2.8} /></group>;
  if (id === 'habitat') return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('habitat')} /><FacilityActivity {...signature} height={1.15} /></group>;
  return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('oxygen')} /><RuntimeAsset asset={requirePrototypeAsset('oxygen-vent')} /><FacilityActivity {...signature} height={1.55} /></group>;
}

function StreetLights({ debugState }: { readonly debugState: PrototypeDebugState }) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const intensity = getLampIntensity(debugState.timeOfDay);
  return <>{getStreetLightPlacements().slice(0, quality.streetLights).map(([x, z], index) => <group key={`${x}:${z}`}><RuntimeAsset asset={requirePrototypeAsset('street-light')} position={[x, 0.18, z]} rotationY={index % 2 ? Math.PI : 0} />{intensity > 0 && <pointLight castShadow={index < 2 && quality.shadows} color="#ffb664" distance={4.5} intensity={intensity} position={[x, 1.85, z]} />}</group>)}</>;
}

function Snow({ count }: { readonly count: number }) {
  const points = useRef<import('three').Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const seed = index * 16807 % 2147483647;
      values[index * 3] = 1.5 + ((seed % 1000) / 1000 - 0.5) * 25;
      values[index * 3 + 1] = 1 + ((seed * 17 % 1000) / 1000) * 12;
      values[index * 3 + 2] = ((seed * 31 % 1000) / 1000 - 0.5) * 18;
    }
    return values;
  }, [count]);
  useFrame((_, delta) => { if (points.current) points.current.rotation.y += delta * 0.015; });
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#e8f7ff" opacity={0.72} size={0.06} transparent depthWrite={false} blending={AdditiveBlending} /></points>;
}

function Colonist({ index }: { readonly index: number }) {
  const group = useRef<import('three').Group>(null);
  const pose = useRef(getColonistPose(index, 0));
  const [animation, setAnimation] = useState(() => getColonistPose(index, 0).animation);
  useFrame(({ clock }) => {
    pose.current = getColonistPose(index, clock.elapsedTime);
    setAnimation((current) => current === pose.current.animation ? current : pose.current.animation);
    if (!group.current) return;
    group.current.visible = pose.current.visible;
    group.current.position.set(...pose.current.position);
    group.current.rotation.y = MathUtils.lerp(group.current.rotation.y, pose.current.rotationY, 0.14);
  });
  return <group ref={group} scale={0.92}><RuntimeAsset asset={requirePrototypeAsset('prototype-astronaut')} animation={animation} /></group>;
}

function MaintenanceWorker({ facility }: { readonly facility: 'mine' | 'reactor' }) {
  const [x, z] = getFacilityWorkPoint(facility);
  return <group position={[x, 0.32, z]} rotation-y={Math.PI} scale={0.92}><RuntimeAsset animation="Weapon" asset={requirePrototypeAsset('prototype-astronaut')} /><pointLight color="#f1c46e" distance={2.2} intensity={0.8} position={[0, 1.1, 0]} /></group>;
}

function Ground() {
  const { groundCenter, groundDepth, groundWidth } = PROTOTYPE_LAYOUT.camera;
  return (
    <group position={[groundCenter[0], -0.08, groundCenter[1]]}>
      <mesh receiveShadow rotation-x={-Math.PI / 2} scale={[groundWidth / 24, groundDepth / 24, 1]}>
        <circleGeometry args={[12, 12]} />
        <meshStandardMaterial color="#93a7ad" roughness={1} metalness={0} />
      </mesh>
      {([[-5, 0.012, 2.7, 2.2], [4.2, 0.014, -2.4, 2.8], [0.5, 0.016, 4.8, 1.8]] as const).map(([x, y, z, radius], index) => <mesh key={index} position={[x, y, z]} rotation-x={-Math.PI / 2}><circleGeometry args={[radius, 16]} /><meshStandardMaterial color="#b8c9cc" opacity={0.16} roughness={0.92} transparent /></mesh>)}
    </group>
  );
}

function WorldContent({ debugPanelOpen, debugState, onMetrics }: WorldSceneProps) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const night = isNight(debugState.timeOfDay);
  const skyColor = night ? '#07101b' : '#9fb8c0';
  const roadTiles = getRoadTilePlacements();
  return (
    <>
      <color attach="background" args={[skyColor]} />
      {debugState.fogEnabled && <fog attach="fog" args={[skyColor, night ? 22 : 26, night ? 48 : 52]} />}
      <ambientLight intensity={night ? 0.72 : 1.45} color={night ? '#6f87a8' : '#d7eef2'} />
      <directionalLight castShadow={quality.shadows} color={night ? '#86a1cd' : '#fff1d3'} intensity={night ? 1.05 : 2.4} position={[-12, 20, 10]} shadow-mapSize={[1024, 1024]} />
      <Ground />
      <Suspense fallback={null}>
        {roadTiles.map(({ position: [x, z], rotationY }) => <RuntimeAsset key={`${x}:${z}`} asset={requirePrototypeAsset('road-tile')} position={[x, 0.02, z]} rotationY={rotationY} scaleMultiplier={0.36} />)}
        {(['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen'] as const).map((id) => <Facility key={id} debugState={debugState} id={id} />)}
        {(() => { const placement = getFacilityPlacement('expansion'); return <group position={[placement.position[0], 0.1, placement.position[1]]} rotation-y={placement.rotationY}><RuntimeAsset asset={requirePrototypeAsset('expansion-pad')} /></group>; })()}
        {PROTOTYPE_LAYOUT.zones.outerRocks.map(([x, z, rotation, scale], index) => <RuntimeAsset key={`outer-${index}`} asset={requirePrototypeAsset('rock-large')} position={[x, 0.12, z]} rotationY={rotation} scaleMultiplier={scale} />)}
        {PROTOTYPE_LAYOUT.zones.transitionRocks.map(([x, z, rotation], index) => <RuntimeAsset key={`transition-${index}`} asset={requirePrototypeAsset(index % 2 ? 'rock-small-a' : 'rock-small-b')} position={[x, 0.12, z]} rotationY={rotation} />)}
        {PROTOTYPE_LAYOUT.zones.coreCrates.map(([x, z, rotation], index) => <RuntimeAsset key={`crate-${index}`} asset={requirePrototypeAsset('supply-crate')} position={[x, 0.14, z]} rotationY={rotation} />)}
        {roadTiles.filter((_, index) => index % 3 === 0).map(({ position: [x, z] }, index) => <RuntimeAsset key={`floor-${index}`} asset={requirePrototypeAsset('floor-light')} position={[x, 0.16, z]} />)}
        <StreetLights debugState={debugState} />
        {Array.from({ length: debugState.colonistCount }, (_, index) => <Colonist key={index} index={index} />)}
        {debugState.reactorState === 'maintenance' && <MaintenanceWorker facility="reactor" />}
        {debugState.mineState === 'maintenance' && <MaintenanceWorker facility="mine" />}
      </Suspense>
      {debugState.snowEnabled && <Snow count={quality.snowParticles} />}
      <MetricsProbe onMetrics={onMetrics} particleCount={debugState.snowEnabled ? quality.snowParticles : 0} />
      <CameraRig panelOpen={debugPanelOpen} preset={debugState.cameraPreset} />
    </>
  );
}

export function WorldScene({ debugPanelOpen, debugState, onMetrics }: WorldSceneProps) {
  const quality = QUALITY_PROFILES[debugState.quality];
  return (
    <div aria-label="Koloni görsel prototipi" className="world-scene-shell">
      <Canvas dpr={quality.dpr} orthographic camera={{ near: 0.1, far: 140, zoom: 30 }} shadows={quality.shadows} gl={{ antialias: debugState.quality !== 'low', powerPreference: 'high-performance' }}>
        <WorldContent debugPanelOpen={debugPanelOpen} debugState={debugState} onMetrics={onMetrics} />
      </Canvas>
    </div>
  );
}
