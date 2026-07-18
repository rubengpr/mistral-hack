import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyzeFieldPhoto = vi.hoisted(() => vi.fn());
const completeMistralChat = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/field-photo-analysis-service', () => ({
  analyzeFieldPhoto,
  FieldPhotoAnalysisError: class FieldPhotoAnalysisError extends Error {},
}));

vi.mock('@/lib/services/mistral-chat-service', () => ({
  completeMistralChat,
  EmptyMistralResponseError: class EmptyMistralResponseError extends Error {},
}));

import { POST } from '@/app/api/chat/route';
import { getCanonicalDemoState } from '@/lib/fixtures/canonical-demo-scenario';

const analysis = {
  observation: 'Leaf edges appear curled.',
  inference: 'The signs are compatible with mild water stress.',
  uncertainty: 'The cause cannot be confirmed from one image.',
  recommendedVerification: 'Check soil moisture in the affected row.',
};

function createRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  analyzeFieldPhoto.mockReset();
  completeMistralChat.mockReset();
  analyzeFieldPhoto.mockResolvedValue(analysis);
  completeMistralChat.mockResolvedValue({
    message: 'Analysis ready.',
    actions: [],
  });
});

describe('chat route field photos', () => {
  it('rejects a turn without text or a photo', async () => {
    const response = await POST(
      createRequest({
        messages: [{ role: 'user', content: '' }],
        selectedParcelId: 'parcel-herault-06',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Enter a message or attach a field photo before sending.',
    });
  });

  it('rejects an unsupported photo data URL', async () => {
    const response = await POST(
      createRequest({
        messages: [{ role: 'user', content: '' }],
        selectedParcelId: 'parcel-herault-06',
        photo: {
          id: 'photo-01',
          capturedAt: '2026-07-18T12:00:00Z',
          dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
          fileName: 'field-photo.gif',
          mediaType: 'image/gif',
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(analyzeFieldPhoto).not.toHaveBeenCalled();
  });

  it('rejects a field photo larger than 1.5 MB', async () => {
    const oversizedImage = Buffer.alloc(1_500_001).toString('base64');
    const response = await POST(
      createRequest({
        messages: [{ role: 'user', content: '' }],
        selectedParcelId: 'parcel-herault-06',
        photo: {
          id: 'photo-01',
          capturedAt: '2026-07-18T12:00:00Z',
          dataUrl: `data:image/jpeg;base64,${oversizedImage}`,
          fileName: 'field-photo.jpg',
          mediaType: 'image/jpeg',
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(analyzeFieldPhoto).not.toHaveBeenCalled();
  });

  it('accepts a photo-only turn and adds its analysis to chat context', async () => {
    const state = getCanonicalDemoState();
    const response = await POST(
      createRequest({
        messages: [{ role: 'user', content: '' }],
        selectedParcelId: state.activeInspection.parcelId,
        inspectionHistory: state.activeInspection,
        photo: {
          id: 'photo-01',
          capturedAt: '2026-07-18T12:00:00Z',
          dataUrl: 'data:image/jpeg;base64,/9j/',
          fileName: 'field-photo.jpg',
          mediaType: 'image/jpeg',
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        message: 'Analysis ready.',
        photoAnalysis: { photoId: 'photo-01', analysis },
      },
    });
    expect(completeMistralChat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Supporting field photo analysis'),
        }),
      ]),
      expect.objectContaining({
        inspectionHistory: expect.objectContaining({
          photos: [expect.objectContaining({ id: 'photo-01', analysis })],
        }),
      }),
    );
  });
});
