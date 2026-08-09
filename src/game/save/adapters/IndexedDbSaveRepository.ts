import type { SaveRecord, SaveRepository } from '../SaveRepository';

export class IndexedDbAdapterNotImplementedError extends Error {
  constructor() {
    super('IndexedDB persistence is deferred beyond the Phase 0 adapter boundary.');
    this.name = 'IndexedDbAdapterNotImplementedError';
  }
}

/** Browser adapter stub. Atomic write/backup behavior is intentionally not implemented in Phase 0. */
export class IndexedDbSaveRepository implements SaveRepository {
  constructor(private readonly indexedDb: IDBFactory) {}

  read(id: string): Promise<SaveRecord | null> {
    void this.indexedDb;
    void id;
    return Promise.reject(new IndexedDbAdapterNotImplementedError());
  }

  write(record: SaveRecord): Promise<void> {
    void this.indexedDb;
    void record;
    return Promise.reject(new IndexedDbAdapterNotImplementedError());
  }
}
