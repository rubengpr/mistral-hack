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
  selectedParcelNotes: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(100),
        content: z.string().trim().min(1).max(2_000),
        createdAt: z.iso.datetime(),
        observation: z.string().trim().min(1).max(1_000).optional(),
        assessment: z.string().trim().min(1).max(1_000).optional(),
        uncertainty: z.string().trim().min(1).max(1_000).optional(),
        nextStep: z.string().trim().min(1).max(1_000).optional(),
      }),
    )
    .max(20)
    .optional(),
  photos: z
    .array(fieldPhotoSchema)
    .min(1)
    .max(3)
    .refine(
      (photos) => new Set(photos.map(({ id }) => id)).size === photos.length,
      'Each field photo must have a unique ID.',
    )
    .optional(),
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
            photoIds: z
              .array(z.string().trim().min(1).max(100))
              .max(3)
              .optional(),
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
            nextStep: z.string().trim().min(1).max(1_000).optional(),
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

  if (!lastMessage?.content && !parsedRequest.data.photos) {
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
    let photoAnalyses;

    if (parsedRequest.data.photos) {
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

      const parcelContext = await getSelectedParcelContext(
        parsedRequest.data.selectedParcelId,
        inspectionHistory,
      );
      const analyzedPhotos = await Promise.all(
        parsedRequest.data.photos.map(async (photo) => ({
          id: photo.id,
          capturedAt: photo.capturedAt,
          dataUrl: photo.dataUrl,
          analysis: await analyzeFieldPhoto({
            photo,
            technicianMessage: lastMessage?.content ?? '',
            parcelContext,
          }),
        })),
      );
      const photoIds = new Set(analyzedPhotos.map(({ id }) => id));

      inspectionHistory = {
        ...inspectionHistory,
        status:
          inspectionHistory.status === 'not-started'
            ? ('in-progress' as const)
            : inspectionHistory.status,
        photos: [
          ...inspectionHistory.photos.filter(({ id }) => !photoIds.has(id)),
          ...analyzedPhotos,
        ],
      };
      messages = messages.map((message, index) =>
        index === messages.length - 1
          ? {
              ...message,
              content: `${message.content || 'Analyze these field photos as supporting evidence.'}\n\nSupporting field photo analyses: ${JSON.stringify(analyzedPhotos.map(({ id, analysis }) => ({ photoId: id, analysis })))}`,
            }
          : message,
      );
      photoAnalyses = analyzedPhotos.map(({ id, analysis }) => ({
        photoId: id,
        analysis,
      }));
    }

    const result = await completeMistralChat(messages, {
      selectedParcelId: parsedRequest.data.selectedParcelId,
      inspectionHistory,
      selectedParcelNotes: parsedRequest.data.selectedParcelNotes,
    });

    return NextResponse.json({
      success: true,
      data: { ...result, photoAnalyses },
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
