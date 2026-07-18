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
        photos: [
          {
            id: 'photo-01',
            capturedAt: '2026-07-18T12:00:00Z',
            dataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
            fileName: 'field-photo.gif',
            mediaType: 'image/gif',
          },
        ],
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
        photos: [
          {
            id: 'photo-01',
            capturedAt: '2026-07-18T12:00:00Z',
            dataUrl: `data:image/jpeg;base64,${oversizedImage}`,
            fileName: 'field-photo.jpg',
            mediaType: 'image/jpeg',
          },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(analyzeFieldPhoto).not.toHaveBeenCalled();
  });

  it('accepts up to three photos and adds their analyses to chat context', async () => {
    const state = getCanonicalDemoState();
    const photos = ['photo-01', 'photo-02', 'photo-03'].map((id) => ({
      id,
      capturedAt: '2026-07-18T12:00:00Z',
      dataUrl: 'data:image/jpeg;base64,/9j/',
      fileName: `${id}.jpg`,
      mediaType: 'image/jpeg',
    }));
    const response = await POST(
      createRequest({
        messages: [{ role: 'user', content: '' }],
        selectedParcelId: state.activeInspection.parcelId,
        inspectionHistory: state.activeInspection,
        photos,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        message: 'Analysis ready.',
        photoAnalyses: [
          { photoId: 'photo-01', analysis },
          { photoId: 'photo-02', analysis },
          { photoId: 'photo-03', analysis },
        ],
      },
    });
    expect(completeMistralChat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Supporting field photo analyses'),
        }),
      ]),
      expect.objectContaining({
        inspectionHistory: expect.objectContaining({
          photos: photos.map(({ id }) =>
            expect.objectContaining({ id, analysis }),
          ),
        }),
      }),
    );
    expect(analyzeFieldPhoto).toHaveBeenCalledTimes(3);
  });

  it('rejects more than three photos', async () => {
    const state = getCanonicalDemoState();
    const photos = ['01', '02', '03', '04'].map((suffix) => ({
      id: `photo-${suffix}`,
      capturedAt: '2026-07-18T12:00:00Z',
      dataUrl: 'data:image/jpeg;base64,/9j/',
      fileName: `photo-${suffix}.jpg`,
      mediaType: 'image/jpeg',
    }));
    const response = await POST(
      createRequest({
        messages: [{ role: 'user', content: '' }],
        selectedParcelId: state.activeInspection.parcelId,
        inspectionHistory: state.activeInspection,
        photos,
      }),
    );

    expect(response.status).toBe(400);
    expect(analyzeFieldPhoto).not.toHaveBeenCalled();
  });

  it('preserves saved photo evidence for a follow-up without re-uploading it', async () => {
    const state = getCanonicalDemoState();
    state.activeInspection.photos.push({
      id: 'photo-01',
      capturedAt: '2026-07-18T12:00:00Z',
      dataUrl: 'data:image/jpeg;base64,/9j/',
      analysis,
    });
    const response = await POST(
      createRequest({
        messages: [
          { role: 'user', content: 'What did you see in the pictures?' },
        ],
        selectedParcelId: state.activeInspection.parcelId,
        inspectionHistory: state.activeInspection,
      }),
    );

    expect(response.status).toBe(200);
    expect(analyzeFieldPhoto).not.toHaveBeenCalled();
    expect(completeMistralChat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'What did you see in the pictures?' }],
      expect.objectContaining({
        inspectionHistory: expect.objectContaining({
          photos: [expect.objectContaining({ id: 'photo-01', analysis })],
        }),
      }),
    );
  });
});
