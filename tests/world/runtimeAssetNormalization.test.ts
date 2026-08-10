import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import type { AssetDefinition } from '../../src/game/world/assets/AssetRegistry';
import { normalizeAssetMaterials } from '../../src/game/world/renderer/assetMaterialNormalization';

const asset: AssetDefinition = {
  id: 'normalization-fixture',
  materialProfile: { metalness: 0.25, roughness: 0.75, tint: '#cceeff' },
  originalPath: 'assets-source/fixture.gltf',
  runtimePath: '/assets/runtime/fixture.gltf',
  shadowProfile: 'facility',
  sourceBounds: { depth: 1, height: 1, width: 1 },
  sourcePack: 'fixture',
};

describe('runtime asset material normalization', () => {
  it('preserves a single-material mesh as a single material', () => {
    const sourceMaterial = new MeshStandardMaterial();
    const mesh = new Mesh(new BoxGeometry(), sourceMaterial);
    const root = new Group();
    root.add(mesh);

    normalizeAssetMaterials(root, asset);

    expect(Array.isArray(mesh.material)).toBe(false);
    expect(mesh.material).not.toBe(sourceMaterial);
    expect(mesh.material).toMatchObject({ roughness: 0.75 });
    expect(mesh.castShadow).toBe(true);
  });

  it('preserves multi-material mesh arrays', () => {
    const mesh = new Mesh(new BoxGeometry(), [new MeshStandardMaterial(), new MeshStandardMaterial()]);
    const root = new Group();
    root.add(mesh);

    normalizeAssetMaterials(root, asset);

    expect(Array.isArray(mesh.material)).toBe(true);
    expect(mesh.material).toHaveLength(2);
  });

  it('honors an explicit asset-level shadow-casting override', () => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
    const root = new Group();
    root.add(mesh);
    normalizeAssetMaterials(root, { ...asset, castShadow: false });
    expect(mesh.castShadow).toBe(false);
  });
});
