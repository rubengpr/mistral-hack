import { afterEach, describe, expect, it, vi } from 'vitest';

const transcriptionComplete = vi.hoisted(() => vi.fn());

vi.mock('@/lib/integrations/mistral/client', () => ({
  createMistralClient: () => ({
    audio: { transcriptions: { complete: transcriptionComplete } },
  }),
}));

import {
  getVoiceTranscriptionModel,
  MistralVoiceResponseError,
  transcribeMistralVoice,
} from '@/lib/services/mistral-voice-service';

const originalModel = process.env.MISTRAL_TRANSCRIPTION_MODEL;
const originalLanguage = process.env.MISTRAL_TRANSCRIPTION_LANGUAGE;

afterEach(() => {
  transcriptionComplete.mockReset();

  if (originalModel === undefined) {
    delete process.env.MISTRAL_TRANSCRIPTION_MODEL;
  } else {
    process.env.MISTRAL_TRANSCRIPTION_MODEL = originalModel;
  }

  if (originalLanguage === undefined) {
    delete process.env.MISTRAL_TRANSCRIPTION_LANGUAGE;
  } else {
    process.env.MISTRAL_TRANSCRIPTION_LANGUAGE = originalLanguage;
  }
});

describe('Mistral voice service', () => {
  it('transcribes a complete browser voice turn', async () => {
    process.env.MISTRAL_TRANSCRIPTION_MODEL = 'voxtral-demo';
    process.env.MISTRAL_TRANSCRIPTION_LANGUAGE = 'es';
    transcriptionComplete.mockResolvedValue({
      text: ' Revisa el sector norte. ',
    });
    const audio = new Blob([new Uint8Array([1, 2])], { type: 'audio/wav' });

    await expect(transcribeMistralVoice(audio)).resolves.toBe(
      'Revisa el sector norte.',
    );
    expect(transcriptionComplete).toHaveBeenCalledWith({
      model: 'voxtral-demo',
      file: audio,
      language: 'es',
    });
  });

  it('rejects an empty transcription', async () => {
    transcriptionComplete.mockResolvedValue({ text: '   ' });

    await expect(
      transcribeMistralVoice(new Blob([new Uint8Array([1])])),
    ).rejects.toBeInstanceOf(MistralVoiceResponseError);
  });

  it('uses the configured transcription model', () => {
    process.env.MISTRAL_TRANSCRIPTION_MODEL = 'voxtral-demo';
    expect(getVoiceTranscriptionModel()).toBe('voxtral-demo');
  });

  it('migrates a stale realtime model to the reliable turn model', () => {
    process.env.MISTRAL_TRANSCRIPTION_MODEL =
      'voxtral-mini-transcribe-realtime-2602';
    expect(getVoiceTranscriptionModel()).toBe('voxtral-mini-2602');
  });
});
