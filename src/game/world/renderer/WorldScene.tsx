import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { BufferAttribute, Mesh, PointLight, Shape } from 'three';

import { useSimulationSnapshot } from '../../../app/providers/simulationContext';
import type { ColonistState } from '../../domain/workforce/Workforce';
import type { SimulationSnapshot } from '../../simulation/SimulationSnapshot';
import { requirePrototypeAsset } from '../assets/prototypeAssetRegistry';
import { getGeneratedFacility, getGeneratedRoadTilePlacements } from '../layout/layoutQueries';
import type { GeneratedPlanetLayout } from '../layout/layoutTypes';
import { getAuthoritativeColonistPose } from '../prototype/authoritativeColonistPresentation';
import { getPrototypeCharacterAssetId } from '../prototype/navigation';
import { advanceSnowField, createSnowField } from '../prototype/environmentPresentation';
import { getFacilityVisualSignature, getLampIntensity, isNight, QUALITY_PROFILES } from '../prototype/prototypeConfig';
import type { FacilityId, PrototypeDebugState, WorldMetrics } from '../prototype/types';
import { getFacilityActivityScale, getHazePosition, isMaintenanceActivityPulse } from '../presentation/PresentationClock';
import { ColonistMotionInterpolator, interpolateFacing } from '../presentation/ColonistMotionInterpolator';
import { CameraRig } from './CameraRig';
import { PresentationTimeDriver, PresentationTimeProvider } from './PresentationTime';
import { usePresentationClock } from './presentationTimeContext';
import { RuntimeAsset } from './RuntimeAsset';
import { inspectRuntimeObject, type RuntimeObjectInspection } from './runtimeObjectInspector';
import { LayoutDebugOverlay } from './LayoutDebugOverlay';

interface WorldSceneProps {
  readonly cameraResetToken: number;
  readonly debugPanelOpen: boolean;
  readonly debugState: PrototypeDebugState;
  readonly onMetrics: (metrics: WorldMetrics) => void;
  readonly onObjectInspection: (inspection: RuntimeObjectInspection) => void;
  readonly layout: GeneratedPlanetLayout;
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

function Facility({ debugState, id, layout, simulationState }: { readonly debugState: PrototypeDebugState; readonly id: FacilityId; readonly layout: GeneratedPlanetLayout; readonly simulationState: SimulationSnapshot['facilities'][number] | undefined }) {
  const placement = getGeneratedFacility(layout, id);
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
    <FacilityActivity {...signature} height={1.15} />
  </group>;
  return <group {...groupProps}><RuntimeAsset asset={requirePrototypeAsset('oxygen')} /><RuntimeAsset asset={requirePrototypeAsset('oxygen-vent')} /><FacilityActivity {...signature} height={1.55} /></group>;
}

function StreetLights({ debugState, layout }: { readonly debugState: PrototypeDebugState; readonly layout: GeneratedPlanetLayout }) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const intensity = getLampIntensity(debugState.timeOfDay);
  return <>{layout.streetLights.slice(0, quality.streetLights).map((light, index) => <group key={light.id}><RuntimeAsset asset={requirePrototypeAsset('street-light')} position={[light.position[0], 0.18, light.position[1]]} rotationY={index % 2 ? Math.PI : 0} />{intensity > 0 && <pointLight castShadow={index < 2 && quality.shadows} color="#ffb664" distance={4.5} intensity={intensity} position={[light.position[0], 1.85, light.position[1]]} />}</group>)}</>;
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

function LocalFrozenHaze({ layout }: { readonly layout: GeneratedPlanetLayout }) {
  const mist = useRef<import('three').Group>(null);
  const presentationClock = usePresentationClock();
  const hazeAnchors = useMemo(() => {
    const { minX, maxX, minZ, maxZ, center } = layout.cameraBounds;
    return [[minX + 2, maxZ - 2], [minX + 5, minZ + 2], [center[0], maxZ - 1.5], [maxX - 5, minZ + 2], [maxX - 2, maxZ - 3]] as const;
  }, [layout.cameraBounds]);
  useFrame(() => {
    if (!mist.current) return;
    mist.current.children.forEach((child, index) => {
      const anchor = hazeAnchors[index];
      if (!anchor) return;
      const [x, z] = getHazePosition(anchor, index, presentationClock.getElapsedSeconds());
      child.position.x = x;
      child.position.z = z;
    });
  });
  return <group ref={mist}>{hazeAnchors.map(([x, z], index) => <mesh key={index} position={[x, 0.12 + index % 2 * 0.03, z]} rotation-x={-Math.PI / 2} scale={[1.8 + index % 3 * 0.35, 1.1, 1]}><circleGeometry args={[2.4, 14]} /><meshBasicMaterial color="#d4e2e5" depthWrite={false} opacity={0.035} transparent /></mesh>)}</group>;
}

function Colonist({ colonist, fixedStepPresentationSeconds, layout }: { readonly colonist: ColonistState; readonly fixedStepPresentationSeconds: number; readonly layout: GeneratedPlanetLayout }) {
  const group = useRef<import('three').Group>(null);
  const character = useRef<import('three').Group>(null);
  const presentationClock = usePresentationClock();
  const [motion] = useState(() => new ColonistMotionInterpolator(colonist));
  useLayoutEffect(() => motion.observe(colonist), [colonist, motion]);
  const initialPose = getAuthoritativeColonistPose(motion.sample(), layout);
  const [animation, setAnimation] = useState(initialPose.animation);
  const [activity, setActivity] = useState(initialPose.activity);
  const activityRef = useRef(activity);
  const animationRef = useRef(animation);
  const index = Number.parseInt(colonist.id.split('-').at(-1) ?? '1', 10) - 1;
  useFrame(() => {
    const deltaSeconds = presentationClock.getDeltaSeconds();
    if (!group.current || !character.current) return;
    const pose = getAuthoritativeColonistPose(motion.advance(deltaSeconds, fixedStepPresentationSeconds), layout);
    character.current.visible = pose.visible;
    group.current.position.set(...pose.position);
    group.current.rotation.y = interpolateFacing(group.current.rotation.y, pose.rotationY, deltaSeconds);
    if (animationRef.current !== pose.animation) {
      animationRef.current = pose.animation;
      setAnimation(pose.animation);
    }
    if (activityRef.current !== pose.activity) {
      activityRef.current = pose.activity;
      setActivity(pose.activity);
    }
  });
  return <group ref={group} position={initialPose.position} rotation-y={initialPose.rotationY} scale={0.92}>
    <group ref={character} visible={initialPose.visible}><RuntimeAsset asset={requirePrototypeAsset(getPrototypeCharacterAssetId(index))} animation={animation} /></group>
    {activity && <MaintenanceActivity />}
  </group>;
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

function Ground({ layout }: { readonly layout: GeneratedPlanetLayout }) {
  const plateau = useMemo(() => {
    const shape = new Shape();
    const { minX, maxX, minZ, maxZ } = layout.cameraBounds;
    const corners = [[minX + 1.2, minZ], [maxX - 1.2, minZ], [maxX, minZ + 1.2], [maxX, maxZ - 1.2], [maxX - 1.2, maxZ], [minX + 1.2, maxZ], [minX, maxZ - 1.2], [minX, minZ + 1.2]] as const;
    corners.forEach(([x, z], index) => index === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z));
    shape.closePath();
    return shape;
  }, [layout.cameraBounds]);
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

function WorldContent({ cameraResetToken, debugPanelOpen, debugState, layout, onMetrics, onObjectInspection, simulationSnapshot }: WorldSceneProps & { readonly simulationSnapshot: SimulationSnapshot }) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const night = isNight(debugState.timeOfDay);
  const skyColor = night ? '#07101b' : '#9fb8c0';
  const roadTiles = getGeneratedRoadTilePlacements(layout);
  return (
    <>
      <color attach="background" args={[skyColor]} />
      {debugState.fogEnabled && <fog attach="fog" args={[skyColor, night ? 58 : 64, night ? 96 : 105]} />}
      <ambientLight intensity={night ? 0.72 : 1.45} color={night ? '#6f87a8' : '#d7eef2'} />
      <directionalLight castShadow={quality.shadows} color={night ? '#86a1cd' : '#fff1d3'} intensity={night ? 1.05 : 2.4} position={[-12, 20, 10]} shadow-mapSize={[1024, 1024]} />
      <group onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        if (!debugState.objectInspectorEnabled) return;
        event.stopPropagation();
        onObjectInspection(inspectRuntimeObject(event.object));
      }}>
        <Ground layout={layout} />
        {debugState.fogEnabled && <LocalFrozenHaze layout={layout} />}
        <Suspense fallback={null}>
        {roadTiles.map(({ position: [x, z], rotationY }) => <RuntimeAsset key={`${x}:${z}`} asset={requirePrototypeAsset('road-tile')} position={[x, 0.02, z]} rotationY={rotationY} scaleMultiplier={0.36} />)}
        {(['reactor', 'solar', 'battery', 'mine', 'habitat', 'oxygen'] as const).map((id) => {
          const instanceId = id === 'reactor' ? 'reactor-01' : id === 'mine' ? 'mine-01' : id === 'oxygen' ? 'oxygen-processor-01' : id === 'battery' ? 'battery-01' : undefined;
          return <Facility key={id} debugState={debugState} id={id} layout={layout} simulationState={simulationSnapshot.facilities.find(({ id: facilityId }) => facilityId === instanceId)} />;
        })}
        {layout.expansionSlots.map((placement) => <group key={placement.id} position={[placement.position[0], 0.1, placement.position[1]]} rotation-y={placement.rotationY}><RuntimeAsset asset={requirePrototypeAsset('expansion-pad')} /></group>)}
        {layout.propZones.flatMap((zone) => [-0.33, 0.33].map((offset, index) => <RuntimeAsset key={`${zone.id}-${index}`} asset={requirePrototypeAsset(index % 2 ? 'rock-small-a' : 'rock-small-b')} position={[zone.center[0] + offset * zone.width, 0.12, zone.center[1] + (index ? -0.27 : 0.27) * zone.depth]} rotationY={(zone.seedOffset + index) * 0.73} />))}
        <StreetLights debugState={debugState} layout={layout} />
        {simulationSnapshot.colonists.map((colonist) => <Colonist colonist={colonist} fixedStepPresentationSeconds={simulationSnapshot.clock.fixedStepMinutes * simulationSnapshot.clock.realSecondsPerSimulationHour / 60} key={colonist.id} layout={layout} />)}
        </Suspense>
        {debugState.layoutOverlayVisible && <LayoutDebugOverlay layout={layout} />}
      </group>
      {debugState.snowEnabled && <Snow count={quality.snowParticles} />}
      <MetricsProbe onMetrics={onMetrics} particleCount={debugState.snowEnabled ? quality.snowParticles : 0} />
      <CameraRig layout={layout} panelOpen={debugPanelOpen} preset={debugState.cameraPreset} resetToken={cameraResetToken} />
    </>
  );
}

export function WorldScene({ cameraResetToken, debugPanelOpen, debugState, layout, onMetrics, onObjectInspection }: WorldSceneProps) {
  const quality = QUALITY_PROFILES[debugState.quality];
  const simulationSnapshot = useSimulationSnapshot();
  return (
    <div aria-label="Koloni görsel prototipi" className="world-scene-shell">
      <PresentationTimeProvider speed={simulationSnapshot.clock.speed}>
        <Canvas dpr={quality.dpr} orthographic camera={{ near: 0.1, far: 140, zoom: 30 }} shadows={quality.shadows} gl={{ antialias: debugState.quality !== 'low', powerPreference: 'high-performance' }}>
          <PresentationTimeDriver />
          <WorldContent cameraResetToken={cameraResetToken} debugPanelOpen={debugPanelOpen} debugState={debugState} layout={layout} onMetrics={onMetrics} onObjectInspection={onObjectInspection} simulationSnapshot={simulationSnapshot} />
        </Canvas>
      </PresentationTimeProvider>
    </div>
  );
}
