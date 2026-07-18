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
} from '@/lib/services/mistral-chat-service';

afterEach(() => {
  chatComplete.mockReset();
});

describe('Mistral chat service', () => {
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
