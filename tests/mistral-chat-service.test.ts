import { describe, expect, it } from 'vitest';

import { extractMistralText } from '@/lib/services/mistral-chat-service';

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
});
