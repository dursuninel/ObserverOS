export interface SaveEnvelope {
  readonly contentRevision?: string;
  readonly gameVersion: string;
  readonly payload: unknown;
  readonly saveVersion: number;
}

export interface SaveRecord {
  readonly envelope: SaveEnvelope;
  readonly id: string;
}

/** Domain port; persistence technology belongs to infrastructure adapters. */
export interface SaveRepository {
  read(id: string): Promise<SaveRecord | null>;
  write(record: SaveRecord): Promise<void>;
}

