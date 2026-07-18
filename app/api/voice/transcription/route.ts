import { NextResponse } from 'next/server';

import { MistralConfigurationError } from '@/lib/integrations/mistral/client';
import {
  MistralVoiceResponseError,
  transcribeMistralVoice,
} from '@/lib/services/mistral-voice-service';

const MAX_AUDIO_BYTES = 2_000_000;
const MIN_AUDIO_BYTES = 1_000;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'The voice request must contain valid audio data.' },
      { status: 400 },
    );
  }

  const audio = formData.get('audio');

  if (!(audio instanceof File)) {
    return NextResponse.json(
      { error: 'A voice recording is required.' },
      { status: 400 },
    );
  }

  if (audio.size < MIN_AUDIO_BYTES || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: 'The voice recording must be between 0.1 and 60 seconds.' },
      { status: 400 },
    );
  }

  try {
    const transcript = await transcribeMistralVoice(audio);

    return NextResponse.json({ success: true, data: { transcript } });
  } catch (error) {
    if (error instanceof MistralConfigurationError) {
      return NextResponse.json(
        {
          error:
            'Mistral voice is not configured. Add MISTRAL_API_KEY and restart the app.',
        },
        { status: 503 },
      );
    }

    if (error instanceof MistralVoiceResponseError) {
      return NextResponse.json(
        {
          error: 'Vinea could not understand that recording. Please try again.',
        },
        { status: 422 },
      );
    }

    console.error('Mistral voice transcription failed.', error);

    return NextResponse.json(
      {
        error:
          'Voice transcription is unavailable right now. Please try again.',
      },
      { status: 502 },
    );
  }
}
