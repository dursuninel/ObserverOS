import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { AnimationMixer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

import type { AssetDefinition } from '../assets/AssetRegistry';
import { normalizeAssetMaterials } from './assetMaterialNormalization';

interface RuntimeAssetProps {
  readonly animation?: string;
  readonly asset: AssetDefinition;
  readonly position?: readonly [number, number, number];
  readonly rotationY?: number;
  readonly scaleMultiplier?: number;
}

export function RuntimeAsset({ animation, asset, position = [0, 0, 0], rotationY = 0, scaleMultiplier = 1 }: RuntimeAssetProps) {
  const gltf = useLoader(GLTFLoader, asset.runtimePath);
  const object = useMemo(() => {
    const instance = clone(gltf.scene);
    normalizeAssetMaterials(instance, asset);
    return instance;
  }, [asset, gltf.scene]);
  const mixer = useMemo(() => animation ? new AnimationMixer(object) : null, [animation, object]);
  const currentAction = useRef<string | null>(null);

  useEffect(() => {
    if (!mixer || !animation || currentAction.current === animation) return;
    mixer.stopAllAction();
    const clip = gltf.animations.find((candidate) => candidate.name === animation) ?? gltf.animations[0];
    if (clip) mixer.clipAction(clip).reset().fadeIn(0.15).play();
    currentAction.current = animation;
  }, [animation, gltf.animations, mixer]);

  useEffect(() => () => { mixer?.stopAllAction(); }, [mixer]);
  useFrame((_, delta) => mixer?.update(delta));

  const offset = asset.transform?.offset;
  return (
    <primitive
      object={object}
      position={[position[0] + (offset?.x ?? 0), position[1] + (offset?.y ?? 0), position[2] + (offset?.z ?? 0)]}
      rotation={[0, rotationY + (asset.transform?.rotationY ?? 0), 0]}
      scale={(asset.transform?.scale ?? 1) * scaleMultiplier}
    />
  );
}
