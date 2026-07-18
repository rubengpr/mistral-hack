import { NextResponse } from 'next/server';
import { z } from 'zod';

import { MistralConfigurationError } from '@/lib/integrations/mistral/client';
import {
  analyzeFieldPhoto,
  FieldPhotoAnalysisError,
} from '@/lib/services/field-photo-analysis-service';
import {
  completeMistralChat,
  EmptyMistralResponseError,
} from '@/lib/services/mistral-chat-service';
import {
  getSelectedParcelContext,
  ParcelContextNotFoundError,
} from '@/lib/services/parcel-context-service';

const FIELD_PHOTO_MAX_BYTES = 1_500_000;
const FIELD_PHOTO_DATA_URL_PATTERN =
  /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function getDataUrlByteLength(dataUrl: string) {
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);

  return Buffer.byteLength(encoded, 'base64');
}

const fieldPhotoSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    capturedAt: z.iso.datetime(),
    dataUrl: z
      .string()
      .max(2_100_000)
      .regex(FIELD_PHOTO_DATA_URL_PATTERN)
      .refine(
        (dataUrl) => getDataUrlByteLength(dataUrl) <= FIELD_PHOTO_MAX_BYTES,
        'The field photo must be 1.5 MB or smaller.',
      ),
    fileName: z.string().trim().min(1).max(255),
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  })
  .refine(
    ({ dataUrl, mediaType }) => dataUrl.startsWith(`data:${mediaType};base64,`),
    'The field photo media type does not match its data URL.',
  );

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().max(8_000),
      }),
    )
    .min(1)
    .max(40),
  selectedParcelId: z.string().trim().min(1).max(100),
  photo: fieldPhotoSchema.optional(),
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
            observation: z.string().trim().min(1).max(1_000).optional(),
            assessment: z.string().trim().min(1).max(1_000).optional(),
            uncertainty: z.string().trim().min(1).max(1_000).optional(),
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

  const lastMessage = parsedRequest.data.messages.at(-1);

  if (!lastMessage?.content && !parsedRequest.data.photo) {
    return NextResponse.json(
      { error: 'Enter a message or attach a field photo before sending.' },
      { status: 400 },
    );
  }

  if (
    parsedRequest.data.messages
      .slice(0, -1)
      .some((message) => message.content.length === 0)
  ) {
    return NextResponse.json(
      { error: 'Previous chat messages cannot be empty.' },
      { status: 400 },
    );
  }

  try {
    let messages = parsedRequest.data.messages;
    let inspectionHistory = parsedRequest.data.inspectionHistory;
    let photoAnalysis;

    if (parsedRequest.data.photo) {
      if (
        !inspectionHistory ||
        inspectionHistory.parcelId !== parsedRequest.data.selectedParcelId
      ) {
        return NextResponse.json(
          {
            error:
              'A matching active inspection is required to save a field photo.',
          },
          { status: 409 },
        );
      }

      const parcelContext = getSelectedParcelContext(
        parsedRequest.data.selectedParcelId,
        inspectionHistory,
      );
      const analysis = await analyzeFieldPhoto({
        photo: parsedRequest.data.photo,
        technicianMessage: lastMessage?.content ?? '',
        parcelContext,
      });
      const photo = {
        id: parsedRequest.data.photo.id,
        capturedAt: parsedRequest.data.photo.capturedAt,
        dataUrl: parsedRequest.data.photo.dataUrl,
        analysis,
      };

      inspectionHistory = {
        ...inspectionHistory,
        status:
          inspectionHistory.status === 'not-started'
            ? ('in-progress' as const)
            : inspectionHistory.status,
        photos: [
          ...inspectionHistory.photos.filter(({ id }) => id !== photo.id),
          photo,
        ],
      };
      messages = messages.map((message, index) =>
        index === messages.length - 1
          ? {
              ...message,
              content: `${message.content || 'Analyze this field photo as supporting evidence.'}\n\nSupporting field photo analysis: ${JSON.stringify(analysis)}`,
            }
          : message,
      );
      photoAnalysis = { photoId: photo.id, analysis };
    }

    const result = await completeMistralChat(messages, {
      selectedParcelId: parsedRequest.data.selectedParcelId,
      inspectionHistory,
    });

    return NextResponse.json({
      success: true,
      data: { ...result, photoAnalysis },
    });
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

    if (error instanceof FieldPhotoAnalysisError) {
      return NextResponse.json(
        {
          error: 'Mistral could not analyze the field photo. Please try again.',
        },
        { status: 502 },
      );
    }

    if (error instanceof ParcelContextNotFoundError) {
      return NextResponse.json(
        { error: 'The selected parcel could not be found.' },
        { status: 404 },
      );
    }

    console.error('Mistral chat request failed.', error);

    return NextResponse.json(
      { error: 'Mistral could not answer right now. Please try again.' },
      { status: 502 },
    );
  }
}
