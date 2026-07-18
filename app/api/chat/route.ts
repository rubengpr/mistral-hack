import { NextResponse } from 'next/server';
import { z } from 'zod';

import { MistralConfigurationError } from '@/lib/integrations/mistral/client';
import {
  completeMistralChat,
  EmptyMistralResponseError,
} from '@/lib/services/mistral-chat-service';

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(8_000),
      }),
    )
    .min(1)
    .max(40),
});

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

  const parsedRequest = chatRequestSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: 'Send between 1 and 40 valid chat messages.' },
      { status: 400 },
    );
  }

  if (parsedRequest.data.messages.at(-1)?.role !== 'user') {
    return NextResponse.json(
      { error: 'The final chat message must come from the user.' },
      { status: 400 },
    );
  }

  try {
    const message = await completeMistralChat(parsedRequest.data.messages);

    return NextResponse.json({ success: true, data: { message } });
  } catch (error) {
    if (error instanceof MistralConfigurationError) {
      return NextResponse.json(
        {
          error:
            'Mistral is not configured. Add MISTRAL_API_KEY and restart the app.',
        },
        { status: 503 },
      );
    }

    if (error instanceof EmptyMistralResponseError) {
      return NextResponse.json(
        { error: 'Mistral returned an empty response. Please try again.' },
        { status: 502 },
      );
    }

    console.error('Mistral chat request failed.', error);

    return NextResponse.json(
      { error: 'Mistral could not answer right now. Please try again.' },
      { status: 502 },
    );
  }
}
