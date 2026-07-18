import type {
  SpeechStreamChunk,
  VoiceTranscriptionResponse,
} from '@/types/voice-conversation';

const STOP_COMMANDS = new Set([
  'basta',
  'deten la conversacion',
  'para la conversacion',
  'termina la conversacion',
  'terminar conversacion',
]);

export function normalizeVoiceCommand(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isStopVoiceCommand(value: string) {
  return STOP_COMMANDS.has(normalizeVoiceCommand(value));
}

export function isVoiceTranscriptionResponse(
  value: unknown,
): value is VoiceTranscriptionResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Partial<VoiceTranscriptionResponse>;

  return (
    response.success === true && typeof response.data?.transcript === 'string'
  );
}

export function isSpeechStreamChunk(
  value: unknown,
): value is SpeechStreamChunk {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Partial<SpeechStreamChunk>;

  return (
    response.success === true &&
    typeof response.data?.audioData === 'string' &&
    typeof response.data.done === 'boolean' &&
    response.data.encoding === 'pcm_f32le' &&
    response.data.sampleRate === 24_000
  );
}

export function decodeBase64Audio(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function decodePcmFloat32(value: Uint8Array) {
  const sampleCount = Math.floor(value.byteLength / 4);
  const samples = new Float32Array(sampleCount);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getFloat32(index * 4, true);
  }

  return samples;
}

export function createPcm16WavBlob(chunks: Uint8Array[], sampleRate: number) {
  const audioByteLength = chunks.reduce(
    (total, chunk) => total + chunk.byteLength,
    0,
  );
  const wav = new Uint8Array(44 + audioByteLength);
  const view = new DataView(wav.buffer);

  function writeAscii(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      wav[offset + index] = value.charCodeAt(index);
    }
  }

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + audioByteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, audioByteLength, true);

  let offset = 44;
  for (const chunk of chunks) {
    wav.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Blob([wav], { type: 'audio/wav' });
}
