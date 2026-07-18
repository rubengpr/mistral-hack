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
  selectedParcelId: z.string().trim().min(1).max(100),
  inspectionHistory: z
    .object({
      id: z.string().trim().min(1).max(100),
      findingId: z.string().trim().min(1).max(100),
      parcelId: z.string().trim().min(1).max(100),
      sectorId: z.string().trim().min(1).max(100),
      status: z.enum(['not-started', 'in-progress', 'ready-for-review']),
      technicianName: z.string().trim().min(1).max(200).optional(),
      conversation: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(100),
            role: z.enum(['technician', 'assistant']),
            content: z.string().trim().min(1).max(8_000),
            createdAt: z.iso.datetime(),
          }),
        )
        .max(40),
      notes: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(100),
            content: z.string().trim().min(1).max(2_000),
            createdAt: z.iso.datetime(),
          }),
        )
        .max(20),
      photos: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(100),
            dataUrl: z.string().max(8_000_000),
            capturedAt: z.iso.datetime(),
            analysis: z
              .object({
                observation: z.string().trim().min(1).max(2_000),
                inference: z.string().trim().min(1).max(2_000),
                uncertainty: z.string().trim().min(1).max(2_000),
                recommendedVerification: z.string().trim().min(1).max(2_000),
              })
              .optional(),
          }),
        )
        .max(10),
      actions: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(100),
            description: z.string().trim().min(1).max(1_000),
            completedAt: z.iso.datetime(),
          }),
        )
        .max(20),
      nextStep: z.string().trim().min(1).max(1_000),
    })
    .optional(),
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
    const result = await completeMistralChat(parsedRequest.data.messages, {
      selectedParcelId: parsedRequest.data.selectedParcelId,
      inspectionHistory: parsedRequest.data.inspectionHistory,
    });

    return NextResponse.json({ success: true, data: result });
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
