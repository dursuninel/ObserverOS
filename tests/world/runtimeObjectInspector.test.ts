import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Group, Mesh } from 'three';
import { describe, expect, it } from 'vitest';

import { inspectRuntimeObject } from '../../src/game/world/renderer/runtimeObjectInspector';
import { requirePrototypeAsset } from '../../src/game/world/assets/prototypeAssetRegistry';

describe('DEV runtime object inspector', () => {
  it('identifies the actual ambiguous floor geometry and the X-shadow caster by scene-graph name', () => {
    const floor = JSON.parse(readFileSync(resolve('public/assets/runtime/modular/Prop_Light_Floor.gltf'), 'utf8')) as { meshes: Array<{ name: string }>; nodes: Array<{ name: string }> };
    const streetLight = JSON.parse(readFileSync(resolve('public/assets/runtime/kaykit/lights.gltf'), 'utf8')) as { meshes: Array<{ name: string }>; nodes: Array<{ name: string }> };
    expect(floor.nodes[0]?.name).toBe('Prop_Light_Floor');
    expect(floor.meshes[0]?.name).toBe('Plane.152');
    expect(streetLight.nodes[0]?.name).toBe('lights');
    expect(streetLight.meshes[0]?.name).toBe('Cube.15107');
  });

  it('resolves mesh, parent, asset provenance and world position from the runtime ancestor chain', () => {
    const scene = new Group();
    const runtimeRoot = new Group();
    runtimeRoot.name = 'RuntimeRoot';
    runtimeRoot.position.set(1.1, 0.2, -1.2);
    runtimeRoot.userData = { runtimeAssetId: 'floor-light', sourcePack: 'quaternius-modular' };
    const parent = new Group();
    parent.name = 'Scene';
    const mesh = new Mesh();
    mesh.name = 'Prop_Light_Floor';
    scene.add(runtimeRoot);
    runtimeRoot.add(parent);
    parent.add(mesh);
    scene.updateMatrixWorld(true);

    expect(inspectRuntimeObject(mesh)).toMatchObject({
      ancestorChain: ['Prop_Light_Floor', 'Scene', 'RuntimeRoot', 'Group'],
      meshNodeName: 'Prop_Light_Floor',
      objectName: 'Prop_Light_Floor',
      parentName: 'Scene',
      runtimeAssetId: 'floor-light',
      sourcePack: 'quaternius-modular',
      worldPosition: [1.1, 0.2, -1.2],
    });
  });

  it('does not render the ambiguous floor-light asset in the prototype world', () => {
    const source = readFileSync(resolve('src/game/world/renderer/WorldScene.tsx'), 'utf8');
    expect(source).not.toContain("requirePrototypeAsset('floor-light')");
  });

  it('prevents the street-light mesh from casting an object-like X shadow', () => {
    expect(requirePrototypeAsset('street-light').castShadow).toBe(false);
    expect(requirePrototypeAsset('street-light').shadowProfile).toBe('prop');
  });
});
