import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chatParse = vi.hoisted(() => vi.fn());

vi.mock('@/lib/integrations/mistral/client', () => ({
  createMistralClient: () => ({
    chat: { parse: chatParse },
  }),
}));

import {
  analyzeFieldPhoto,
  FieldPhotoAnalysisError,
} from '@/lib/services/field-photo-analysis-service';
import { getSelectedParcelContext } from '@/lib/services/parcel-context-service';

const analysis = {
  observation: 'Several leaf edges appear curled and pale.',
  inference: 'The visible signs are compatible with mild water stress.',
  uncertainty: 'A single photograph cannot confirm the cause.',
  recommendedVerification: 'Check soil moisture and inspect the emitters.',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
});

afterEach(() => {
  chatParse.mockReset();
  vi.unstubAllGlobals();
});

describe('field photo analysis service', () => {
  it('sends the image and verified parcel context to Mistral', async () => {
    chatParse.mockResolvedValue({
      choices: [{ message: { parsed: analysis } }],
    });

    await expect(
      analyzeFieldPhoto({
        photo: {
          id: 'photo-01',
          capturedAt: '2026-07-18T12:00:00Z',
          dataUrl: 'data:image/jpeg;base64,/9j/',
          fileName: 'field-photo.jpg',
          mediaType: 'image/jpeg',
        },
        technicianMessage: 'What can you see?',
        parcelContext: await getSelectedParcelContext('parcel-herault-06'),
      }),
    ).resolves.toEqual(analysis);

    const request = chatParse.mock.calls[0]?.[0];
    const content = request.messages[1].content;

    expect(content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'image_url' }),
        expect.objectContaining({ type: 'text' }),
      ]),
    );
    expect(JSON.stringify(content)).toContain('parcel-herault-06');
  });

  it('rejects an empty structured response', async () => {
    chatParse.mockResolvedValue({ choices: [{ message: {} }] });

    await expect(
      analyzeFieldPhoto({
        photo: {
          id: 'photo-01',
          capturedAt: '2026-07-18T12:00:00Z',
          dataUrl: 'data:image/jpeg;base64,/9j/',
          fileName: 'field-photo.jpg',
          mediaType: 'image/jpeg',
        },
        technicianMessage: '',
        parcelContext: await getSelectedParcelContext('parcel-herault-06'),
      }),
    ).rejects.toBeInstanceOf(FieldPhotoAnalysisError);
  });
});
