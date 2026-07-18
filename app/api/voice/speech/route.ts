import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { MistralConfigurationError } from '@/lib/integrations/mistral/client';
import { streamMistralSpeech } from '@/lib/services/mistral-voice-service';
import type { SpeechStreamChunk } from '@/types/voice-conversation';

const speechRequestSchema = z.object({
  text: z.string().trim().min(1).max(3_000),
});

const encoder = new TextEncoder();

function encodeChunk(audioData: string, done: boolean) {
  const payload: SpeechStreamChunk = {
    success: true,
    data: {
      audioData,
      done,
      encoding: 'pcm_f32le',
      sampleRate: 24_000,
    },
  };

  return encoder.encode(`${JSON.stringify(payload)}\n`);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'The request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const parsedRequest = speechRequestSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: 'Speech text must contain between 1 and 3,000 characters.' },
      { status: 400 },
    );
  }

  try {
    const speechEvents = await streamMistralSpeech(parsedRequest.data.text);
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of speechEvents) {
            if (event.data.type === 'speech.audio.delta') {
              const normalizedAudio = Buffer.from(
                event.data.audioData,
                'base64',
              ).toString('base64');
              controller.enqueue(encodeChunk(normalizedAudio, false));
            }
          }

          controller.enqueue(encodeChunk('', true));
          controller.close();
        } catch (error) {
          console.error('Mistral speech stream failed.', error);
          controller.error(error);
        }
      },
      cancel() {
        return speechEvents.cancel('Client closed the speech stream.');
      },
    });

    return new Response(body, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/x-ndjson; charset=utf-8',
      },
    });
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

    console.error('Mistral speech request failed.', error);

    return NextResponse.json(
      { error: 'Mistral could not generate speech. Please try again.' },
      { status: 502 },
    );
  }
}
