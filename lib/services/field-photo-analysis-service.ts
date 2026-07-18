import { z } from 'zod';

import { createMistralClient } from '@/lib/integrations/mistral/client';
import type { SelectedParcelContext } from '@/lib/services/parcel-context-service';
import type { FieldPhotoAnalysis } from '@/types/agricultural-operations';
import type { MistralChatPhoto } from '@/types/mistral-chat';

const fieldPhotoAnalysisSchema = z.object({
  observation: z.string().trim().min(1).max(2_000),
  inference: z.string().trim().min(1).max(2_000),
  uncertainty: z.string().trim().min(1).max(2_000),
  recommendedVerification: z.string().trim().min(1).max(2_000),
});

export class FieldPhotoAnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FieldPhotoAnalysisError';
  }
}

function createAnalysisContext(context: SelectedParcelContext) {
  return {
    parcel: context.parcel,
    alerts: context.alerts,
    sensors: {
      sourceLabel: context.sensors.sourceLabel,
      items: context.sensors.items,
    },
    weather: {
      sourceLabel: context.weather.sourceLabel,
      quality: context.weather.quality,
      startsOn: context.weather.startsOn,
      endsOn: context.weather.endsOn,
      totalPrecipitationMillimeters:
        context.weather.totalPrecipitationMillimeters,
      maximumTemperatureCelsius: context.weather.maximumTemperatureCelsius,
      totalEvapotranspirationMillimeters:
        context.weather.totalEvapotranspirationMillimeters,
    },
  };
}

export async function analyzeFieldPhoto(input: {
  photo: MistralChatPhoto;
  technicianMessage: string;
  parcelContext: SelectedParcelContext;
}): Promise<FieldPhotoAnalysis> {
  const client = createMistralClient();
  const response = await client.chat.parse({
    model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
    messages: [
      {
        role: 'system',
        content:
          'Analyze a technician-provided vineyard field photograph as supporting evidence. Describe only visible observations in observation. Correlate cautiously with the supplied parcel evidence in inference. State material limitations in uncertainty. Recommend a concrete field verification, not a definitive diagnosis or autonomous treatment. Never mention or allude to demos, simulations, fixtures, mocks, prototypes, test data, or internal data provenance. Reply in the same language as the technician message.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              technicianMessage:
                input.technicianMessage ||
                'Analyze this field photo as supporting evidence.',
              parcelContext: createAnalysisContext(input.parcelContext),
            }),
          },
          {
            type: 'image_url',
            imageUrl: input.photo.dataUrl,
          },
        ],
      },
    ],
    responseFormat: fieldPhotoAnalysisSchema,
  });
  const parsed = response.choices?.[0]?.message?.parsed;
  const result = fieldPhotoAnalysisSchema.safeParse(parsed);

  if (!result.success) {
    throw new FieldPhotoAnalysisError(
      'Mistral did not return a valid field photo analysis.',
    );
  }

  return result.data;
}
