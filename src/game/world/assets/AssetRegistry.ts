export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AssetTransform {
  readonly offset?: Vec3;
  readonly rotationY?: number;
  readonly scale?: number;
}

export interface AssetDefinition {
  readonly animationClips?: readonly string[];
  readonly castShadow?: boolean;
  readonly hiddenNodeNames?: readonly string[];
  readonly id: string;
  readonly materialProfile?: {
    readonly emissiveIntensity?: number;
    readonly metalness?: number;
    readonly roughness?: number;
    readonly tint?: string;
  };
  readonly originalPath: string;
  readonly runtimePath: string;
  readonly shadowProfile?: string;
  readonly sourceBounds: {
    readonly depth: number;
    readonly height: number;
    readonly width: number;
  };
  readonly sourcePack: string;
  readonly targetFootprint?: {
    readonly depth: number;
    readonly width: number;
  };
  readonly transform?: AssetTransform;
  readonly visualCenter?: Vec3;
  readonly entrancePoint?: Vec3;
  readonly workPoint?: Vec3;
  readonly visualHooks?: readonly string[];
}

export class AssetRegistry {
  readonly #definitions = new Map<string, AssetDefinition>();

  register(definition: AssetDefinition): void {
    if (this.#definitions.has(definition.id)) {
      throw new Error(`Asset "${definition.id}" is already registered.`);
    }

    this.#definitions.set(definition.id, definition);
  }

  get(id: string): AssetDefinition | undefined {
    return this.#definitions.get(id);
  }

  list(): readonly AssetDefinition[] {
    return [...this.#definitions.values()];
  }
}
