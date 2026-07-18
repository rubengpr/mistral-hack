import type {
  DemoState,
  FieldPhoto,
  Inspection,
} from '@/types/agricultural-operations';
import type { InspectionNoteDraft } from '@/types/agent-tools';

type PersistedTurn = {
  assistant: {
    id: string;
    content: string;
    createdAt: string;
  };
  technician: {
    id: string;
    content: string;
    createdAt: string;
    photoIds?: string[];
  };
};

type ApplyInspectionTurnInput = {
  noteDraft?: InspectionNoteDraft;
  photos?: FieldPhoto[];
  selectedParcelId: string;
  turn: PersistedTurn;
};

type ApplyParcelNoteInput = {
  createdAt: string;
  noteDraft: InspectionNoteDraft;
  targetParcelIds: string[];
  turnId: string;
};

export class InspectionStateMismatchError extends Error {
  constructor() {
    super('The selected parcel does not match the active inspection.');
    this.name = 'InspectionStateMismatchError';
  }
}

function appendUniqueConversationTurn(
  inspection: Inspection,
  turn: Inspection['conversation'][number],
) {
  return inspection.conversation.some(({ id }) => id === turn.id)
    ? inspection.conversation
    : [...inspection.conversation, turn];
}

function noteContent(draft: InspectionNoteDraft) {
  return [draft.observation, draft.assessment, draft.uncertainty].join(' ');
}

export function applyParcelNote(
  state: DemoState,
  input: ApplyParcelNoteInput,
): DemoState {
  const parcelNotes = { ...state.parcelNotes };

  for (const parcelId of new Set(input.targetParcelIds)) {
    const note = {
      id: `note-${input.turnId}`,
      content: noteContent(input.noteDraft),
      createdAt: input.createdAt,
      observation: input.noteDraft.observation,
      assessment: input.noteDraft.assessment,
      uncertainty: input.noteDraft.uncertainty,
      nextStep: input.noteDraft.nextStep,
    };
    const existingNotes = parcelNotes[parcelId] ?? [];

    parcelNotes[parcelId] = [
      ...existingNotes.filter(({ id }) => id !== note.id),
      note,
    ].slice(-20);
  }

  return { ...state, parcelNotes };
}

export function applySuccessfulInspectionTurn(
  state: DemoState,
  input: ApplyInspectionTurnInput,
): DemoState {
  if (state.activeInspection.parcelId !== input.selectedParcelId) {
    throw new InspectionStateMismatchError();
  }

  const { assistant, technician } = input.turn;
  const photos = input.photos ?? [];
  const photoIds = new Set(photos.map(({ id }) => id));
  let conversation = appendUniqueConversationTurn(state.activeInspection, {
    id: technician.id,
    role: 'technician',
    content: technician.content,
    createdAt: technician.createdAt,
    photoIds:
      technician.photoIds ??
      (photos.length > 0 ? photos.map(({ id }) => id) : undefined),
  });
  conversation = appendUniqueConversationTurn(
    { ...state.activeInspection, conversation },
    {
      id: assistant.id,
      role: 'assistant',
      content: assistant.content,
      createdAt: assistant.createdAt,
    },
  );
  conversation = conversation.slice(-40);

  const note = input.noteDraft
    ? {
        id: `note-${technician.id}`,
        content: noteContent(input.noteDraft),
        createdAt: assistant.createdAt,
        observation: input.noteDraft.observation,
        assessment: input.noteDraft.assessment,
        uncertainty: input.noteDraft.uncertainty,
        nextStep: input.noteDraft.nextStep,
      }
    : undefined;
  const action = input.noteDraft?.completedAction
    ? {
        id: `action-${technician.id}`,
        description: input.noteDraft.completedAction,
        completedAt: assistant.createdAt,
      }
    : undefined;
  return {
    ...state,
    activeInspection: {
      ...state.activeInspection,
      status: input.noteDraft
        ? 'ready-for-review'
        : state.activeInspection.status === 'not-started'
          ? 'in-progress'
          : state.activeInspection.status,
      conversation,
      notes: note
        ? [
            ...state.activeInspection.notes.filter(({ id }) => id !== note.id),
            note,
          ].slice(-20)
        : state.activeInspection.notes,
      photos:
        photos.length > 0
          ? [
              ...state.activeInspection.photos.filter(
                ({ id }) => !photoIds.has(id),
              ),
              ...photos,
            ].slice(-10)
          : state.activeInspection.photos,
      actions: action
        ? [
            ...state.activeInspection.actions.filter(
              ({ id }) => id !== action.id,
            ),
            action,
          ].slice(-20)
        : state.activeInspection.actions,
      nextStep: input.noteDraft?.nextStep ?? state.activeInspection.nextStep,
    },
  };
}
