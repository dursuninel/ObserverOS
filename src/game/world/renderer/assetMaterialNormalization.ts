import { BufferGeometry, Color, Material, Mesh, MeshStandardMaterial, Object3D } from 'three';

import type { AssetDefinition } from '../assets/AssetRegistry';

export function normalizeAssetMaterials(root: Object3D, asset: AssetDefinition): void {
  const hiddenNodeNames = new Set(asset.hiddenNodeNames ?? []);
  root.traverse((node) => {
    if (hiddenNodeNames.has(node.name)) node.visible = false;
    if (!(node instanceof Mesh)) return;
    const mesh = node as Mesh<BufferGeometry, Material | Material[]>;
    mesh.castShadow = asset.shadowProfile !== 'ground';
    mesh.receiveShadow = true;
    const currentMaterial = mesh.material;
    const usesMaterialArray = Array.isArray(currentMaterial);
    const sourceMaterials: Material[] = usesMaterialArray ? currentMaterial : [currentMaterial];
    const normalizedMaterials = sourceMaterials.map((source): Material => {
      const material: Material = source.clone();
      if (material instanceof MeshStandardMaterial) {
        material.roughness = asset.materialProfile?.roughness ?? material.roughness;
        material.metalness = asset.materialProfile?.metalness ?? material.metalness;
        if (asset.materialProfile?.tint) material.color.multiply(new Color(asset.materialProfile.tint));
      }
      return material;
    });
    mesh.material = usesMaterialArray ? normalizedMaterials : normalizedMaterials[0] as Material;
  });
}
