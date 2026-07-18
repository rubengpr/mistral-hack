import type { EventStream } from '@mistralai/mistralai/lib/event-streams';
import type { SpeechStreamEvents } from '@mistralai/mistralai/models/operations';
import { createMistralClient } from '@/lib/integrations/mistral/client';

const DEFAULT_TRANSCRIPTION_MODEL = 'voxtral-mini-2602';
const DEFAULT_SPEECH_MODEL = 'voxtral-mini-tts-2603';
const DEFAULT_VOICE_ID = 'c69964a6-ab8b-4f8a-9465-ec0925096ec8';

export class MistralVoiceResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MistralVoiceResponseError';
  }
}

export function getVoiceTranscriptionModel() {
  const configuredModel = process.env.MISTRAL_TRANSCRIPTION_MODEL;

  if (!configuredModel || configuredModel.includes('realtime')) {
    return DEFAULT_TRANSCRIPTION_MODEL;
  }

  return configuredModel;
}

export async function transcribeMistralVoice(audio: Blob) {
  const client = createMistralClient();
  const response = await client.audio.transcriptions.complete({
    model: getVoiceTranscriptionModel(),
    file: audio,
    language: process.env.MISTRAL_TRANSCRIPTION_LANGUAGE || 'es',
  });
  const transcript = response.text.trim();

  if (!transcript) {
    throw new MistralVoiceResponseError(
      'Mistral returned an empty voice transcription.',
    );
  }

  return transcript;
}

export async function streamMistralSpeech(
  input: string,
): Promise<EventStream<SpeechStreamEvents>> {
  const client = createMistralClient();

  return client.audio.speech.complete({
    model: process.env.MISTRAL_SPEECH_MODEL ?? DEFAULT_SPEECH_MODEL,
    input,
    voiceId: process.env.MISTRAL_VOICE_ID || DEFAULT_VOICE_ID,
    responseFormat: 'pcm',
    stream: true,
  });
}
