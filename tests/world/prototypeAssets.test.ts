import { accessSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnimationMixer, Object3D } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { describe, expect, it } from 'vitest';

import { prototypeAssetDefinitions, requirePrototypeAsset } from '../../src/game/world/assets/prototypeAssetRegistry';
import type { AssetDefinition } from '../../src/game/world/assets/AssetRegistry';
import { CharacterAnimationController } from '../../src/game/world/renderer/CharacterAnimationController';
import { normalizeAssetMaterials } from '../../src/game/world/renderer/assetMaterialNormalization';

interface AnimationRigDocument {
  images?: unknown;
  materials?: unknown;
  meshes?: unknown;
  nodes: Array<Record<string, unknown>>;
  samplers?: unknown;
  skins?: unknown;
  textures?: unknown;
}

function ensureProgressEvent(): void {
  if (typeof globalThis.ProgressEvent !== 'undefined') return;
  Object.defineProperty(globalThis, 'ProgressEvent', {
    configurable: true,
    value: class TestProgressEvent {
      constructor(readonly type: string, init: Record<string, unknown> = {}) { Object.assign(this, init); }
    },
  });
}

async function loadActualAnimationRig(asset: AssetDefinition): Promise<GLTF> {
  ensureProgressEvent();
  const document = JSON.parse(readFileSync(resolve('public', asset.runtimePath.slice(1)), 'utf8')) as AnimationRigDocument;
  for (const node of document.nodes) {
    delete node.mesh;
    delete node.skin;
  }
  delete document.meshes;
  delete document.materials;
  delete document.textures;
  delete document.images;
  delete document.samplers;
  delete document.skins;
  return new Promise((resolveGltf, reject) => new GLTFLoader().parse(JSON.stringify(document), '', resolveGltf, reject));
}

function animatedBoneState(root: Object3D): readonly number[] {
  return ['Torso', 'LowerArmL', 'UpperLegL'].flatMap((name) => {
    const node = root.getObjectByName(name);
    if (node === undefined) throw new Error(`Expected animated bone ${name}.`);
    return node.quaternion.toArray();
  });
}

describe('prototype runtime assets', () => {
  it('registers only physical runtime files with source provenance', () => {
    expect(prototypeAssetDefinitions).toHaveLength(22);
    for (const asset of prototypeAssetDefinitions) {
      expect(asset.originalPath.startsWith('assets-source/')).toBe(true);
      expect(asset.runtimePath.startsWith('/assets/runtime/')).toBe(true);
      accessSync(resolve('public', asset.runtimePath.slice(1)));
    }
  });

  it('fails fast for a missing prototype registry entry', () => {
    expect(() => requirePrototypeAsset('missing-asset')).toThrow(/not registered/);
  });

  it('keeps exact source titles and license references in the runtime manifest', () => {
    const manifest = JSON.parse(readFileSync('public/assets/runtime/license-manifest.json', 'utf8')) as { assets: Array<{ id: string; licenseFile: string }>; packs: Array<{ sourceLicense: string; sourceTitle: string }> };
    expect(manifest.packs).toHaveLength(4);
    expect(manifest.packs.find((pack) => pack.sourceLicense.includes('quaternius-ultimate'))?.sourceTitle).toBe('Ultimate Platformer Pack');
    expect(manifest.assets.map((asset) => asset.id).sort()).toEqual(prototypeAssetDefinitions.map((asset) => asset.id).sort());
    expect(manifest.assets.every((asset) => asset.licenseFile.startsWith('assets-source/'))).toBe(true);
  });

  it('caps generated runtime PNG variants at 1024 pixels', () => {
    for (const pack of ['modular', 'essentials']) {
      const directory = resolve('public/assets/runtime', pack);
      for (const file of readdirSync(directory).filter((name) => name.endsWith('.png'))) {
        const png = readFileSync(resolve(directory, file));
        expect(png.readUInt32BE(16)).toBeLessThanOrEqual(1024);
        expect(png.readUInt32BE(20)).toBeLessThanOrEqual(1024);
      }
    }
  });

  it('validates real Idle and Walk clips against every astronaut skeleton', () => {
    const characters = prototypeAssetDefinitions.filter(({ id }) => id.startsWith('prototype-astronaut'));
    expect(characters).toHaveLength(3);
    for (const asset of characters) {
      const gltf = JSON.parse(readFileSync(resolve('public', asset.runtimePath.slice(1)), 'utf8')) as {
        animations: Array<{ channels: Array<{ target: { node: number } }>; name: string }>;
        skins: Array<{ joints: number[] }>;
      };
      const joints = new Set(gltf.skins[0]?.joints ?? []);
      expect(joints.size).toBeGreaterThan(0);
      for (const name of ['Idle', 'Walk']) {
        expect(asset.animationClips).toContain(name);
        const clip = gltf.animations.find((animation) => animation.name === name);
        expect(clip, `${asset.id} ${name}`).toBeDefined();
        expect(clip?.channels.length).toBeGreaterThan(0);
        expect(clip?.channels.every(({ target }) => joints.has(target.node))).toBe(true);
      }
    }
  });

  for (const asset of prototypeAssetDefinitions.filter(({ id }) => id.startsWith('prototype-astronaut'))) {
    it(`evaluates looping Idle and Walk on the actual ${asset.id} animation rig`, async () => {
      const gltf = await loadActualAnimationRig(asset);
      for (const clipName of ['Idle', 'Walk']) {
        const object = clone(gltf.scene);
        const before = animatedBoneState(object);
        const mixer = new AnimationMixer(object);
        const controller = new CharacterAnimationController(mixer, gltf.animations, object);
        controller.activate(clipName);
        expect(controller.getActiveState()).toMatchObject({ effectiveWeight: 1, enabled: true, name: clipName, running: true });
        controller.update(0.4);
        expect(animatedBoneState(object)).not.toEqual(before);
        controller.update(1.2);
        expect(controller.getActiveState()).toMatchObject({ effectiveWeight: 1, enabled: true, name: clipName, running: true });
      }
    });

    it(`keeps an evaluated pose through ten actual ${asset.id} Idle/Walk transitions`, async () => {
      const gltf = await loadActualAnimationRig(asset);
      const object = clone(gltf.scene);
      const controller = new CharacterAnimationController(new AnimationMixer(object), gltf.animations, object);
      for (let index = 0; index < 10; index += 1) {
        controller.activate(index % 2 === 0 ? 'Idle' : 'Walk');
        expect(controller.isReady()).toBe(true);
        controller.update(0.2);
        expect(controller.getActiveState()).toMatchObject({ effectiveWeight: 1, enabled: true, running: true });
      }
    });

    it(`hides declared weapon nodes in the normalized ${asset.id} clone`, async () => {
      const gltf = await loadActualAnimationRig(asset);
      const object = clone(gltf.scene);
      normalizeAssetMaterials(object, asset);
      const weaponNodes = ['Pistol', 'Gun', 'Rifle', 'Weapon', 'Sword'].flatMap((name) => object.getObjectsByProperty('name', name));
      expect(weaponNodes.map(({ name }) => name)).toEqual(['Pistol']);
      expect(weaponNodes.every(({ visible }) => !visible)).toBe(true);
    });
  }
});
