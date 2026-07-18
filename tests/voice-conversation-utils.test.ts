import { describe, expect, it } from 'vitest';

import {
  createPcm16WavBlob,
  isStopVoiceCommand,
  isVoiceTranscriptionResponse,
  normalizeVoiceCommand,
} from '@/lib/audio/voice-conversation-utils';

describe('voice conversation utilities', () => {
  it('normalizes accented and punctuated stop commands', () => {
    expect(normalizeVoiceCommand('¡Termina la conversación!')).toBe(
      'termina la conversacion',
    );
    expect(isStopVoiceCommand('¡Termina la conversación!')).toBe(true);
    expect(isStopVoiceCommand('basta')).toBe(true);
  });

  it('does not stop for a longer sentence that only mentions the command', () => {
    expect(isStopVoiceCommand('No pares hasta que yo diga basta')).toBe(false);
  });

  it('validates a voice transcription response', () => {
    expect(
      isVoiceTranscriptionResponse({
        success: true,
        data: {
          transcript: 'Revisa la parcela norte.',
        },
      }),
    ).toBe(true);
    expect(isVoiceTranscriptionResponse({ success: true, data: {} })).toBe(
      false,
    );
  });

  it('wraps PCM16 chunks in a valid mono WAV file', async () => {
    const blob = createPcm16WavBlob(
      [new Uint8Array([1, 2]), new Uint8Array([3, 4])],
      16_000,
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toBe('audio/wav');
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE');
    expect(new DataView(bytes.buffer).getUint32(24, true)).toBe(16_000);
    expect([...bytes.slice(44)]).toEqual([1, 2, 3, 4]);
  });
});
