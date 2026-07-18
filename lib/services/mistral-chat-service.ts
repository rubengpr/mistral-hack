import type { ContentChunk } from '@mistralai/mistralai/models/components';

import { createMistralClient } from '@/lib/integrations/mistral/client';
import type { MistralChatRequestMessage } from '@/types/mistral-chat';

export class EmptyMistralResponseError extends Error {
  constructor() {
    super('Mistral returned an empty response.');
    this.name = 'EmptyMistralResponseError';
  }
}

export function extractMistralText(
  content: string | ContentChunk[] | null | undefined,
) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!content) {
    return '';
  }

  return content
    .filter(
      (chunk): chunk is ContentChunk & { type: 'text'; text: string } =>
        chunk.type === 'text' && 'text' in chunk,
    )
    .map(({ text }) => text)
    .join('')
    .trim();
}

export async function completeMistralChat(
  messages: MistralChatRequestMessage[],
) {
  const client = createMistralClient();
  const response = await client.chat.complete({
    model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
    messages,
  });
  const message = extractMistralText(response.choices[0]?.message?.content);

  if (!message) {
    throw new EmptyMistralResponseError();
  }

  return message;
}
