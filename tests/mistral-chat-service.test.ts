import { afterEach, describe, expect, it, vi } from 'vitest';

const chatComplete = vi.hoisted(() => vi.fn());

vi.mock('@/lib/integrations/mistral/client', () => ({
  createMistralClient: () => ({
    chat: { complete: chatComplete },
  }),
}));

import {
  completeMistralChat,
  extractMistralText,
  requestsCriticalInspectionRefusal,
  requestsNoteSave,
} from '@/lib/services/mistral-chat-service';
import { getCanonicalDemoState } from '@/lib/fixtures/canonical-demo-scenario';

afterEach(() => {
  chatComplete.mockReset();
});

describe('Mistral chat service', () => {
  it('recognizes explicit note-save requests in supported conversation languages', () => {
    expect(requestsNoteSave("Let's record the note for the team.")).toBe(true);
    expect(requestsNoteSave('Guarda esta información como una nota.')).toBe(
      true,
    );
    expect(requestsNoteSave('What notes are already saved?')).toBe(false);
  });

  it('recognizes a refusal to inspect a critical field alert', () => {
    expect(
      requestsCriticalInspectionRefusal(
        "I'm lazy and don't want to go to the field to inspect the critical flag.",
      ),
    ).toBe(true);
    expect(
      requestsCriticalInspectionRefusal(
        "I don't want to visit the field for a routine inspection.",
      ),
    ).toBe(false);
  });

  it('returns the critical-inspection Easter egg without calling Mistral', async () => {
    await expect(
      completeMistralChat(
        [
          {
            role: 'user',
            content:
              "I'm lazy and don't want to go to the field to inspect the critical flag.",
          },
        ],
        { selectedParcelId: 'parcel-herault-06' },
      ),
    ).resolves.toEqual({
      message:
        'Les Chaton Fat will come and find you if you ignore a critical alert. Grab your boots: this finding still needs field verification.',
      actions: [],
    });
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it('extracts a plain text response', () => {
    expect(extractMistralText('  Hello from Mistral.  ')).toBe(
      'Hello from Mistral.',
    );
  });

  it('joins text chunks and ignores non-text content', () => {
    expect(
      extractMistralText([
        { type: 'text', text: 'First ' },
        {
          type: 'image_url',
          imageUrl: 'https://example.com/image.png',
        },
        { type: 'text', text: 'answer' },
      ]),
    ).toBe('First answer');
  });

  it('returns an empty string when the response has no content', () => {
    expect(extractMistralText(null)).toBe('');
  });

  it('returns a direct answer without executing a tool', async () => {
    chatComplete.mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: 'Hola.' } }],
    });

    await expect(
      completeMistralChat([{ role: 'user', content: 'Hola' }], {
        selectedParcelId: 'parcel-herault-01',
      }),
    ).resolves.toEqual({ message: 'Hola.', actions: [] });

    const request = chatComplete.mock.calls[0]?.[0];
    const systemMessage = request.messages.find(
      (message: { role: string }) => message.role === 'system',
    );

    expect(systemMessage.content).toContain(
      'Always render numeric values with digits and standard unit symbols',
    );
    expect(systemMessage.content).toContain('32%, 33.2%, and 24.5 °C');
    expect(systemMessage.content).toContain('never require English');
  });

  it('does not expose internal data provenance in the final answer', async () => {
    chatComplete.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content:
              'La humedad está bajando. Los datos son simulados de demo. Revisa los goteros.',
          },
        },
      ],
    });

    await expect(
      completeMistralChat([{ role: 'user', content: '¿Qué ocurre?' }], {
        selectedParcelId: 'parcel-herault-06',
      }),
    ).resolves.toEqual({
      message: 'La humedad está bajando. Revisa los goteros.',
      actions: [],
    });
  });

  it('forces the note tool for an explicit save request', async () => {
    chatComplete
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              toolCalls: [
                {
                  id: 'tool-call-note-01',
                  type: 'function',
                  function: {
                    name: 'save_inspection_note',
                    arguments: JSON.stringify({
                      scope: 'cluster',
                      cluster: 'gard',
                      observation:
                        'The Gard parcels require an irrigation plan update.',
                      assessment:
                        'The current plan may not cover forecast demand.',
                      uncertainty: 'Field demand must still be monitored.',
                      nextStep:
                        'Increase irrigation volume by 25% for all Gard parcels.',
                    }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'The note is ready to be saved for the 6 Gard parcels.',
            },
          },
        ],
      });

    const result = await completeMistralChat(
      [
        {
          role: 'user',
          content: "Let's record the note for all these parcels.",
        },
      ],
      { selectedParcelId: 'parcel-gard-06' },
    );

    expect(chatComplete.mock.calls[0]?.[0].toolChoice).toEqual({
      type: 'function',
      function: { name: 'save_inspection_note' },
    });
    expect(result.actions).toEqual([
      expect.objectContaining({
        name: 'save_inspection_note',
        targetParcelIds: expect.arrayContaining([
          'parcel-gard-01',
          'parcel-gard-06',
        ]),
      }),
    ]);
  });

  it('includes saved photo analyses in follow-up chat context without image data', async () => {
    chatComplete.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'I am using the previously analyzed field photo.',
          },
        },
      ],
    });
    const inspection = getCanonicalDemoState().activeInspection;
    inspection.conversation.push({
      id: 'turn-photo-01',
      role: 'technician',
      content: 'Review these irrigation-line photos.',
      createdAt: '2026-07-18T12:00:00Z',
      photoIds: ['photo-01'],
    });
    inspection.photos.push({
      id: 'photo-01',
      capturedAt: '2026-07-18T12:00:00Z',
      dataUrl: 'data:image/jpeg;base64,/9j/private-image-bytes',
      analysis: {
        observation: 'The soil and drip line appear dry.',
        inference: 'This supports a possible irrigation delivery problem.',
        uncertainty: 'Flow cannot be confirmed from the photo.',
        recommendedVerification: 'Measure emitter output in Sector B.',
      },
    });

    await completeMistralChat(
      [{ role: 'user', content: 'What did you see in the pictures?' }],
      {
        selectedParcelId: inspection.parcelId,
        inspectionHistory: inspection,
      },
    );

    const request = chatComplete.mock.calls[0]?.[0];
    const systemMessage = request.messages.find(
      (message: { role: string }) => message.role === 'system',
    );

    expect(systemMessage.content).toContain('Saved field photo evidence');
    expect(systemMessage.content).toContain(
      'The soil and drip line appear dry.',
    );
    expect(systemMessage.content).toContain(
      'Review these irrigation-line photos.',
    );
    expect(systemMessage.content).toContain(
      'Do not say that you cannot inspect images when a saved analysis answers the question.',
    );
    expect(systemMessage.content).not.toContain('private-image-bytes');
  });

  it('executes selected parcel context and returns the grounded answer', async () => {
    chatComplete
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              toolCalls: [
                {
                  id: 'tool-call-01',
                  type: 'function',
                  function: {
                    name: 'get_selected_parcel_context',
                    arguments: '{}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                'La parcela tiene una alerta de humedad activa en el Sector B.',
            },
          },
        ],
      });

    const result = await completeMistralChat(
      [{ role: 'user', content: '¿Qué ocurre en esta parcela?' }],
      { selectedParcelId: 'parcel-herault-06' },
    );

    expect(result.message).toContain('Sector B');
    expect(result.actions).toEqual([
      expect.objectContaining({
        name: 'get_selected_parcel_context',
        status: 'completed',
      }),
    ]);
    expect(chatComplete).toHaveBeenCalledTimes(2);

    const finalRequest = chatComplete.mock.calls[1]?.[0];
    const toolMessage = finalRequest.messages.find(
      (message: { role: string }) => message.role === 'tool',
    );
    expect(toolMessage).toMatchObject({
      name: 'get_selected_parcel_context',
      toolCallId: 'tool-call-01',
    });
    expect(JSON.parse(toolMessage.content)).toMatchObject({
      success: true,
      data: {
        parcel: { id: 'parcel-herault-06' },
        alerts: [{ id: 'finding-soil-moisture-01' }],
      },
    });
  });
});
