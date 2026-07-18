import { z } from 'zod';

import type {
  DemoStateRepository,
  DemoStateStorage,
} from '@/lib/db/demo-state-repository';
import { getCanonicalDemoState } from '@/lib/fixtures/canonical-demo-scenario';
import type { DemoState } from '@/types/agricultural-operations';

export const DEMO_STATE_STORAGE_KEY =
  'mistral-hack:agricultural-operations:demo-state';

const analysisSchema = z.object({
  observation: z.string(),
  inference: z.string(),
  uncertainty: z.string(),
  recommendedVerification: z.string(),
});

const inspectionSchema = z.object({
  id: z.string(),
  findingId: z.string(),
  parcelId: z.string(),
  sectorId: z.string(),
  status: z.enum(['not-started', 'in-progress', 'ready-for-review']),
  technicianName: z.string().optional(),
  conversation: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['technician', 'assistant']),
      content: z.string(),
      createdAt: z.string(),
    }),
  ),
  notes: z.array(
    z.object({
      id: z.string(),
      content: z.string(),
      createdAt: z.string(),
    }),
  ),
  photos: z.array(
    z.object({
      id: z.string(),
      dataUrl: z.string(),
      capturedAt: z.string(),
      analysis: analysisSchema.optional(),
    }),
  ),
  actions: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      completedAt: z.string(),
    }),
  ),
  nextStep: z.string(),
});

const demoStateSchema: z.ZodType<DemoState> = z.object({
  schemaVersion: z.literal(2),
  selectedParcelId: z.string(),
  activeFindingId: z.string(),
  activeInspection: inspectionSchema,
  report: z
    .object({
      reportId: z.string(),
      recipient: z.string(),
      subject: z.string(),
      status: z.enum([
        'drafting',
        'preview-ready',
        'sending',
        'sent',
        'failed',
      ]),
      generatedAt: z.string(),
      providerMessageId: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
});

export class LocalStorageDemoStateRepository implements DemoStateRepository {
  constructor(private readonly storage: DemoStateStorage) {}

  load(): DemoState {
    const storedState = this.storage.getItem(DEMO_STATE_STORAGE_KEY);

    if (storedState === null) {
      return this.reset();
    }

    try {
      const result = demoStateSchema.safeParse(JSON.parse(storedState));

      if (!result.success) {
        return this.reset();
      }

      return structuredClone(result.data);
    } catch {
      return this.reset();
    }
  }

  save(state: DemoState): DemoState {
    const validatedState = demoStateSchema.parse(state);
    const savedState = structuredClone(validatedState);

    this.storage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(savedState));

    return structuredClone(savedState);
  }

  reset(): DemoState {
    const canonicalState = getCanonicalDemoState();

    this.storage.setItem(
      DEMO_STATE_STORAGE_KEY,
      JSON.stringify(canonicalState),
    );

    return structuredClone(canonicalState);
  }
}

export function createBrowserDemoStateRepository(): DemoStateRepository {
  if (typeof window === 'undefined') {
    throw new Error(
      'The browser demo state repository is only available in client code.',
    );
  }

  return new LocalStorageDemoStateRepository(window.localStorage);
}
