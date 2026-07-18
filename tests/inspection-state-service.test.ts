import { describe, expect, it } from 'vitest';

import { getCanonicalDemoState } from '@/lib/fixtures/canonical-demo-scenario';
import {
  applySuccessfulInspectionTurn,
  InspectionStateMismatchError,
} from '@/lib/services/inspection-state-service';

const turn = {
  technician: {
    id: 'turn-technician-01',
    content: 'Record that the symptoms are localized in Sector B.',
    createdAt: '2026-07-18T12:00:00Z',
  },
  assistant: {
    id: 'turn-assistant-01',
    content: 'The inspection note is ready for review.',
    createdAt: '2026-07-18T12:00:01Z',
  },
};

describe('inspection state service', () => {
  it('persists a successful turn and structured note atomically', () => {
    const state = getCanonicalDemoState();
    const nextState = applySuccessfulInspectionTurn(state, {
      selectedParcelId: state.activeInspection.parcelId,
      turn,
      noteDraft: {
        observation: 'Mild symptoms are localized in Sector B.',
        assessment: 'The issue appears limited and was identified early.',
        uncertainty: 'The available evidence does not confirm disease.',
        nextStep: 'Prune affected shoots and reinspect adjacent rows.',
      },
    });

    expect(nextState.activeInspection).toMatchObject({
      status: 'ready-for-review',
      nextStep: 'Prune affected shoots and reinspect adjacent rows.',
      conversation: [
        expect.objectContaining({ role: 'technician' }),
        expect.objectContaining({ role: 'assistant' }),
      ],
      notes: [
        expect.objectContaining({
          observation: 'Mild symptoms are localized in Sector B.',
          uncertainty: 'The available evidence does not confirm disease.',
        }),
      ],
      actions: [],
    });
    expect(state.activeInspection.conversation).toEqual([]);
  });

  it('records only explicitly completed technician actions', () => {
    const state = getCanonicalDemoState();
    const nextState = applySuccessfulInspectionTurn(state, {
      selectedParcelId: state.activeInspection.parcelId,
      turn,
      noteDraft: {
        observation: 'The irrigation line was blocked.',
        assessment: 'The issue was localized.',
        uncertainty: 'Recovery still requires monitoring.',
        completedAction: 'The technician cleared the blocked emitter.',
        nextStep: 'Recheck moisture tomorrow morning.',
      },
    });

    expect(nextState.activeInspection.actions).toEqual([
      expect.objectContaining({
        description: 'The technician cleared the blocked emitter.',
      }),
    ]);
  });

  it('rejects a turn for a parcel outside the active inspection', () => {
    const state = getCanonicalDemoState();

    expect(() =>
      applySuccessfulInspectionTurn(state, {
        selectedParcelId: 'parcel-herault-01',
        turn,
      }),
    ).toThrow(InspectionStateMismatchError);
    expect(state.activeInspection.conversation).toEqual([]);
  });
});
