import { describe, expect, it } from 'vitest';

import {
  DEMO_STATE_STORAGE_KEY,
  LocalStorageDemoStateRepository,
} from '@/lib/db/local-storage-demo-state-repository';
import { getCanonicalDemoState } from '@/lib/fixtures/canonical-demo-scenario';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('LocalStorageDemoStateRepository', () => {
  it('returns and persists the canonical state on first load', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageDemoStateRepository(storage);

    expect(repository.load()).toEqual(getCanonicalDemoState());
    expect(storage.getItem(DEMO_STATE_STORAGE_KEY)).not.toBeNull();
  });

  it('preserves saved changes across repository instances', () => {
    const storage = new MemoryStorage();
    const firstRepository = new LocalStorageDemoStateRepository(storage);
    const state = firstRepository.load();
    state.activeInspection.status = 'in-progress';
    state.activeInspection.notes.push({
      id: 'note-01',
      content: 'Irrigation delivery requires field verification.',
      createdAt: '2026-07-18T09:30:00Z',
    });
    firstRepository.save(state);

    const secondRepository = new LocalStorageDemoStateRepository(storage);

    expect(secondRepository.load().activeInspection).toEqual(
      expect.objectContaining({
        status: 'in-progress',
        notes: [expect.objectContaining({ id: 'note-01' })],
      }),
    );
  });

  it('resets to a fresh canonical state', () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageDemoStateRepository(storage);
    const state = repository.load();
    state.activeInspection.nextStep = 'Mutated value';
    repository.save(state);

    const resetState = repository.reset();
    resetState.activeInspection.nextStep = 'Mutated after reset';

    expect(repository.load()).toEqual(getCanonicalDemoState());
  });

  it('recovers from malformed JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(DEMO_STATE_STORAGE_KEY, '{malformed');

    expect(new LocalStorageDemoStateRepository(storage).load()).toEqual(
      getCanonicalDemoState(),
    );
  });

  it('recovers from an incompatible schema version', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      DEMO_STATE_STORAGE_KEY,
      JSON.stringify({
        ...getCanonicalDemoState(),
        schemaVersion: 1,
      }),
    );

    expect(new LocalStorageDemoStateRepository(storage).load()).toEqual(
      getCanonicalDemoState(),
    );
  });
});
