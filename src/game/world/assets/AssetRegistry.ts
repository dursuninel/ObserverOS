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
  readonly id: string;
  readonly materialProfile?: string;
  readonly shadowProfile?: string;
  readonly sourceBounds: {
    readonly depth: number;
    readonly height: number;
    readonly width: number;
  };
  readonly sourceFile: string;
  readonly sourcePack: string;
  readonly targetFootprint?: {
    readonly depth: number;
    readonly width: number;
  };
  readonly transform?: AssetTransform;
  readonly visualCenter?: Vec3;
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

