import type { DemoState } from '@/types/agricultural-operations';

export interface DemoStateRepository {
  load(): DemoState;
  save(state: DemoState): DemoState;
  reset(): DemoState;
}

export interface DemoStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
