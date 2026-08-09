export interface SaveMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(input: unknown): unknown;
}

/** Ordered migration registration point; concrete migrations begin when a save schema exists. */
export type SaveMigrationRegistry = readonly SaveMigration[];

