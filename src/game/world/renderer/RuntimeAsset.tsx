import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { AnimationMixer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import type { AssetDefinition } from '../assets/AssetRegistry';
import { normalizeAssetMaterials } from './assetMaterialNormalization';
import { CharacterAnimationController } from './CharacterAnimationController';
import { usePresentationClock } from './presentationTimeContext';

interface RuntimeAssetProps {
  readonly animation?: string;
  readonly asset: AssetDefinition;
  readonly position?: readonly [number, number, number];
  readonly rotationY?: number;
  readonly scaleMultiplier?: number;
}

export function RuntimeAsset({ animation, asset, position = [0, 0, 0], rotationY = 0, scaleMultiplier = 1 }: RuntimeAssetProps) {
  const presentationClock = usePresentationClock();
  if (animation && (!asset.animationClips || !asset.animationClips.includes(animation))) {
    throw new Error(`Animation "${animation}" is not declared for prototype asset "${asset.id}".`);
  }
  const gltf = useLoader(GLTFLoader, asset.runtimePath);
  const object = useMemo(() => {
    const instance = clone(gltf.scene);
    normalizeAssetMaterials(instance, asset);
    return instance;
  }, [asset, gltf.scene]);
  const runtimeClip = animation === undefined ? null : gltf.animations.find((candidate) => candidate.name === animation);
  if (animation !== undefined && runtimeClip === undefined) throw new Error(`Animation "${animation}" is missing from runtime asset "${asset.id}".`);
  const mixer = useMemo(() => asset.animationClips === undefined ? null : new AnimationMixer(object), [asset.animationClips, object]);
  const animationController = useMemo(
    () => mixer === null ? null : new CharacterAnimationController(mixer, gltf.animations, object),
    [gltf.animations, mixer, object],
  );
  const presentationRoot = useRef<import('three').Group>(null);

  useLayoutEffect(() => {
    if (animationController !== null && animation !== undefined) {
      animationController.activate(animation);
      if (!animationController.isReady()) throw new Error(`Animation "${animation}" was not ready for visible runtime asset "${asset.id}".`);
    }
    if (presentationRoot.current !== null) presentationRoot.current.visible = true;
  }, [animation, animationController, asset.id]);

  useEffect(() => () => animationController?.dispose(), [animationController]);
  useFrame(() => animationController?.update(presentationClock.getDeltaSeconds()));

  const offset = asset.transform?.offset;
  return (
    <group
      position={[position[0] + (offset?.x ?? 0), position[1] + (offset?.y ?? 0), position[2] + (offset?.z ?? 0)]}
      ref={presentationRoot}
      rotation={[0, rotationY + (asset.transform?.rotationY ?? 0), 0]}
      scale={(asset.transform?.scale ?? 1) * scaleMultiplier}
      userData={{ runtimeAssetId: asset.id, sourcePack: asset.sourcePack }}
      visible={asset.animationClips === undefined}
    >
      <primitive object={object} />
    </group>
  );
}
