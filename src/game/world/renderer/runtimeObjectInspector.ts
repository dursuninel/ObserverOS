import { Vector3, type Object3D } from 'three';

export interface RuntimeObjectInspection {
  readonly ancestorChain: readonly string[];
  readonly meshNodeName: string;
  readonly objectName: string;
  readonly parentName: string;
  readonly runtimeAssetId: string;
  readonly sourcePack: string;
  readonly worldPosition: readonly [number, number, number];
}

function displayName(object: Object3D): string {
  return object.name || object.type;
}

export function inspectRuntimeObject(object: Object3D): RuntimeObjectInspection {
  const ancestorChain: string[] = [];
  let runtimeAssetId = 'unknown';
  let sourcePack = 'unknown';
  let current: Object3D | null = object;
  while (current !== null) {
    ancestorChain.push(displayName(current));
    if (typeof current.userData.runtimeAssetId === 'string') runtimeAssetId = current.userData.runtimeAssetId;
    if (typeof current.userData.sourcePack === 'string') sourcePack = current.userData.sourcePack;
    current = current.parent;
  }
  const position = object.getWorldPosition(new Vector3());
  return Object.freeze({
    ancestorChain: Object.freeze(ancestorChain),
    meshNodeName: displayName(object),
    objectName: displayName(object),
    parentName: object.parent === null ? 'none' : displayName(object.parent),
    runtimeAssetId,
    sourcePack,
    worldPosition: [position.x, position.y, position.z] as const,
  });
}
