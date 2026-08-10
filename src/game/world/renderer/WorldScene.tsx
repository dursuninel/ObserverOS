import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { BufferAttribute, MathUtils, Mesh, PointLight, Shape } from 'three';

import { useSimulationSnapshot } from '../../../app/providers/simulationContext';
import type { ColonistState } from '../../domain/workforce/Workforce';
import type { SimulationSnapshot } from '../../simulation/SimulationSnapshot';
import { requirePrototypeAsset } from '../assets/prototypeAssetRegistry';
import { getAuthoritativeColonistPose } from '../prototype/authoritativeColonistPresentation';
import { getPrototypeCharacterAssetId } from '../prototype/navigation';
import { advanceSnowField, createSnowField } from '../prototype/environmentPresentation';
import { getFacilityVisualSignature, getLampIntensity, isNight, QUALITY_PROFILES } from '../prototype/prototypeConfig';
import { getFacilityPlacement, getRoadTilePlacements, getStreetLightPlacements, PROTOTYPE_LAYOUT } from '../prototype/prototypeLayout';
import type { FacilityId, PrototypeDebugState, WorldMetrics } from '../prototype/types';
import { getFacilityActivityScale, getHazePosition, isMaintenanceActivityPulse } from '../presentation/PresentationClock';
import { CameraRig } from './CameraRig';
import { PresentationTimeDriver, PresentationTimeProvider } from './PresentationTime';
import { usePresentationClock } from './presentationTimeContext';
import { RuntimeAsset } from './RuntimeAsset';

interface WorldSceneProps {
  readonly cameraResetToken: number;
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
  const presentationClock = usePresentationClock();
  useFrame(() => {
    if (!indicator.current) return;
    indicator.current.scale.setScalar(getFacilityActivityScale(speed, presentationClock.getElapsedSeconds()));
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

function Facility({ debugState, id, simulationState }: { readonly debugState: PrototypeDebugState; readonly id: FacilityId; readonly simulationState: SimulationSnapshot['facilities'][number] | undefined }) {
  const placement = getFacilityPlacement(id);
  const state = id === 'reactor'
    ? simulationState?.state === 'maintenance' ? 'maintenance' : simulationState?.state === 'failed' || simulationState?.state === 'interlocked' ? 'interlocked' : simulationState?.mode === 'boost' ? 'boost' : 'normal'
    : id === 'mine'
      ? simulationState?.state === 'maintenance' ? 'maintenance' : simulationState?.state === 'offline' || simulationState?.state === 'failed' ? 'offline' : 'working'
      : 'normal';
  const signature = getFacilityVisualSignature(id, state, debugState.timeOfDay);
  const groupProps = { position: [placement.position[0], 0.18, placement.position[1]] as const, rotation: [0, placement.rotationY, 0] as const };
  if (id === 'reactor') return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('reactor-body')} /><RuntimeAsset asset={requirePrototypeAsset('reactor-tower')} /><FacilityActivity {...signature} height={3.75} /></group>;
  if (id === 'solar') return <group {...groupProps}>{[[-1.8, 0, -0.55], [0, 0, -0.55], [1.8, 0, -0.55], [-0.9, 0, 0.7], [0.9, 0, 0.7]].map(([x, y, z], index) => <RuntimeAsset key={index} asset={requirePrototypeAsset('solar-panel')} position={[x ?? 0, y ?? 0, z ?? 0]} />)}<FacilityActivity {...signature} height={0.45} /></group>;
  if (id === 'battery') return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('battery-body')} /><RuntimeAsset asset={requirePrototypeAsset('battery-cargo')} /><FacilityActivity {...signature} height={1.65} /></group>;
  if (id === 'mine') return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('mine-drill')} /><FacilityActivity {...signature} height={2.8} /></group>;
  if (id === 'habitat') return <group {...groupProps}>
    <mesh position={[0.9, -0.13, 2.35]} rotation-x={-Math.PI / 2} scale={[1.35, 0.72, 1]}><circleGeometry args={[2.15, 10]} /><meshStandardMaterial color="#65787c" roughness={0.92} /></mesh>
    <RuntimeAsset asset={requirePrototypeAsset('habitat')} />
    <RuntimeAsset asset={requirePrototypeAsset('habitat-tunnel')} position={[1.35, 0, 0]} rotationY={Math.PI / 2} />
    <RuntimeAsset asset={requirePrototypeAsset('habitat-annex')} position={[2.65, 0, 0.05]} />
    <RuntimeAsset asset={requirePrototypeAsset('floor-light')} position={[-0.4, 0.02, 2.4]} />
    <RuntimeAsset asset={requirePrototypeAsset('floor-light')} position={[1.2, 0.02, 2.7]} />
    <RuntimeAsset asset={requirePrototypeAsset('floor-light')} position={[2.7, 0.02, 2.35]} />
    <FacilityActivity {...signature} height={1.15} />
  </group>;
  return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('oxygen')} /><RuntimeAsset asset={requirePrototypeAsset('oxygen-vent')} /><FacilityActivity {...signature} height={1.55} /></group>;
}

function StreetLights({ debugState }: { readonly debugState: PrototypeDebugState }) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const intensity = getLampIntensity(debugState.timeOfDay);
  return <>{getStreetLightPlacements().slice(0, quality.streetLights).map(([x, z], index) => <group key={`${x}:${z}`}><RuntimeAsset asset={requirePrototypeAsset('street-light')} position={[x, 0.18, z]} rotationY={index % 2 ? Math.PI : 0} />{intensity > 0 && <pointLight castShadow={index < 2 && quality.shadows} color="#ffb664" distance={4.5} intensity={intensity} position={[x, 1.85, z]} />}</group>)}</>;
}

function Snow({ count }: { readonly count: number }) {
  const positionAttribute = useRef<BufferAttribute>(null);
  const field = useMemo(() => createSnowField(count), [count]);
  const presentationClock = usePresentationClock();
  useFrame(() => {
    const deltaSeconds = presentationClock.getDeltaSeconds();
    if (deltaSeconds === 0) return;
    advanceSnowField(field, deltaSeconds);
    if (positionAttribute.current) positionAttribute.current.needsUpdate = true;
  });
  return <points><bufferGeometry><bufferAttribute ref={positionAttribute} attach="attributes-position" args={[field.positions, 3]} /></bufferGeometry><pointsMaterial color="#dce9ed" opacity={0.58} size={0.045} sizeAttenuation transparent depthWrite={false} /></points>;
}

function LocalFrozenHaze() {
  const mist = useRef<import('three').Group>(null);
  const presentationClock = usePresentationClock();
  useFrame(() => {
    if (!mist.current) return;
    mist.current.children.forEach((child, index) => {
      const anchor = PROTOTYPE_LAYOUT.hazeAnchors[index];
      if (!anchor) return;
      const [x, z] = getHazePosition(anchor, index, presentationClock.getElapsedSeconds());
      child.position.x = x;
      child.position.z = z;
    });
  });
  return <group ref={mist}>{PROTOTYPE_LAYOUT.hazeAnchors.map(([x, z], index) => <mesh key={index} position={[x, 0.12 + index % 2 * 0.03, z]} rotation-x={-Math.PI / 2} scale={[1.8 + index % 3 * 0.35, 1.1, 1]}><circleGeometry args={[2.4, 14]} /><meshBasicMaterial color="#d4e2e5" depthWrite={false} opacity={0.035} transparent /></mesh>)}</group>;
}

function Colonist({ colonist }: { readonly colonist: ColonistState }) {
  const group = useRef<import('three').Group>(null);
  const presentationClock = usePresentationClock();
  const pose = getAuthoritativeColonistPose(colonist);
  const index = Number.parseInt(colonist.id.split('-').at(-1) ?? '1', 10) - 1;
  useFrame(() => {
    const deltaSeconds = presentationClock.getDeltaSeconds();
    if (deltaSeconds === 0) return;
    if (!group.current) return;
    group.current.visible = pose.visible;
    const positionAlpha = 1 - Math.pow(0.78, deltaSeconds * 60);
    group.current.position.x = MathUtils.lerp(group.current.position.x, pose.position[0], positionAlpha);
    group.current.position.y = MathUtils.lerp(group.current.position.y, pose.position[1], positionAlpha);
    group.current.position.z = MathUtils.lerp(group.current.position.z, pose.position[2], positionAlpha);
    const rotationAlpha = 1 - Math.pow(0.86, deltaSeconds * 60);
    group.current.rotation.y = MathUtils.lerp(group.current.rotation.y, pose.rotationY, rotationAlpha);
  });
  return <group ref={group} position={pose.position} rotation-y={pose.rotationY} scale={0.92} visible={pose.visible}><RuntimeAsset asset={requirePrototypeAsset(getPrototypeCharacterAssetId(index))} animation={pose.animation} />{pose.activity && <MaintenanceActivity />}</group>;
}

function MaintenanceActivity() {
  const sparks = useRef<import('three').Group>(null);
  const serviceLight = useRef<PointLight>(null);
  const presentationClock = usePresentationClock();
  useFrame(() => {
    const pulse = isMaintenanceActivityPulse(presentationClock.getElapsedSeconds());
    if (sparks.current) sparks.current.visible = pulse;
    if (serviceLight.current) serviceLight.current.intensity = pulse ? 1.15 : 0.28;
  });
  return <group position={[0.12, 0.72, 0.18]}><group ref={sparks}>{[-0.08, 0, 0.09].map((x, index) => <mesh key={index} position={[x, index * 0.09, index % 2 * 0.05]}><sphereGeometry args={[0.025, 6, 6]} /><meshBasicMaterial color="#ffd18a" /></mesh>)}</group><pointLight ref={serviceLight} color="#f1b861" distance={2} intensity={0.3} /></group>;
}

function Ground() {
  const plateau = useMemo(() => {
    const shape = new Shape();
    PROTOTYPE_LAYOUT.plateauVertices.forEach(([x, z], index) => index === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z));
    shape.closePath();
    return shape;
  }, []);
  return (
    <group>
      <mesh receiveShadow position={[0, -0.08, 0]} rotation-x={-Math.PI / 2}>
        <shapeGeometry args={[plateau]} />
        <meshStandardMaterial color="#93a7ad" roughness={1} metalness={0} />
      </mesh>
      {([[-5, 0.012, 2.7, 2.2], [4.2, 0.014, -2.4, 2.8], [0.5, 0.016, 4.8, 1.8], [8.2, 0.018, 2.7, 1.45]] as const).map(([x, y, z, radius], index) => <mesh key={index} position={[x, y, z]} rotation-x={-Math.PI / 2} rotation-z={index * 0.47}><circleGeometry args={[radius, 7 + index % 2]} /><meshStandardMaterial color={index % 2 ? '#adbec2' : '#c0cfd1'} opacity={0.13} roughness={0.95} transparent /></mesh>)}
    </group>
  );
}

function WorldContent({ cameraResetToken, debugPanelOpen, debugState, onMetrics, simulationSnapshot }: WorldSceneProps & { readonly simulationSnapshot: SimulationSnapshot }) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const night = isNight(debugState.timeOfDay);
  const skyColor = night ? '#07101b' : '#9fb8c0';
  const roadTiles = getRoadTilePlacements();
  return (
    <>
      <color attach="background" args={[skyColor]} />
      {debugState.fogEnabled && <fog attach="fog" args={[skyColor, night ? 58 : 64, night ? 96 : 105]} />}
      <ambientLight intensity={night ? 0.72 : 1.45} color={night ? '#6f87a8' : '#d7eef2'} />
      <directionalLight castShadow={quality.shadows} color={night ? '#86a1cd' : '#fff1d3'} intensity={night ? 1.05 : 2.4} position={[-12, 20, 10]} shadow-mapSize={[1024, 1024]} />
      <Ground />
      {debugState.fogEnabled && <LocalFrozenHaze />}
      <Suspense fallback={null}>
        {roadTiles.map(({ position: [x, z], rotationY }) => <RuntimeAsset key={`${x}:${z}`} asset={requirePrototypeAsset('road-tile')} position={[x, 0.02, z]} rotationY={rotationY} scaleMultiplier={0.36} />)}
        {(['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen'] as const).map((id) => {
          const instanceId = id === 'reactor' ? 'reactor-01' : id === 'mine' ? 'mine-01' : id === 'oxygen' ? 'oxygen-processor-01' : id === 'battery' ? 'battery-01' : undefined;
          return <Facility key={id} debugState={debugState} id={id} simulationState={simulationSnapshot.facilities.find(({ id: facilityId }) => facilityId === instanceId)} />;
        })}
        {(() => { const placement = getFacilityPlacement('expansion'); return <group position={[placement.position[0], 0.1, placement.position[1]]} rotation-y={placement.rotationY}><RuntimeAsset asset={requirePrototypeAsset('expansion-pad')} /></group>; })()}
        {PROTOTYPE_LAYOUT.zones.outerRocks.map(([x, z, rotation, scale], index) => <RuntimeAsset key={`outer-${index}`} asset={requirePrototypeAsset('rock-large')} position={[x, 0.12, z]} rotationY={rotation} scaleMultiplier={scale} />)}
        {PROTOTYPE_LAYOUT.zones.transitionRocks.map(([x, z, rotation], index) => <RuntimeAsset key={`transition-${index}`} asset={requirePrototypeAsset(index % 2 ? 'rock-small-a' : 'rock-small-b')} position={[x, 0.12, z]} rotationY={rotation} />)}
        {PROTOTYPE_LAYOUT.zones.coreCrates.map(([x, z, rotation], index) => <RuntimeAsset key={`crate-${index}`} asset={requirePrototypeAsset('supply-crate')} position={[x, 0.14, z]} rotationY={rotation} />)}
        {roadTiles.filter((_, index) => index % 3 === 0).map(({ position: [x, z] }, index) => <RuntimeAsset key={`floor-${index}`} asset={requirePrototypeAsset('floor-light')} position={[x, 0.16, z]} />)}
        <StreetLights debugState={debugState} />
        {simulationSnapshot.colonists.map((colonist) => <Colonist colonist={colonist} key={colonist.id} />)}
      </Suspense>
      {debugState.snowEnabled && <Snow count={quality.snowParticles} />}
      <MetricsProbe onMetrics={onMetrics} particleCount={debugState.snowEnabled ? quality.snowParticles : 0} />
      <CameraRig panelOpen={debugPanelOpen} preset={debugState.cameraPreset} resetToken={cameraResetToken} />
    </>
  );
}

export function WorldScene({ cameraResetToken, debugPanelOpen, debugState, onMetrics }: WorldSceneProps) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const simulationSnapshot = useSimulationSnapshot();
  return (
    <div aria-label="Koloni görsel prototipi" className="world-scene-shell">
      <PresentationTimeProvider speed={simulationSnapshot.clock.speed}>
        <Canvas dpr={quality.dpr} orthographic camera={{ near: 0.1, far: 140, zoom: 30 }} shadows={quality.shadows} gl={{ antialias: debugState.quality !== 'low', powerPreference: 'high-performance' }}>
          <PresentationTimeDriver />
          <WorldContent cameraResetToken={cameraResetToken} debugPanelOpen={debugPanelOpen} debugState={debugState} onMetrics={onMetrics} simulationSnapshot={simulationSnapshot} />
        </Canvas>
      </PresentationTimeProvider>
    </div>
  );
}
