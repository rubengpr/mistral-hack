export type VoiceConversationState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error';

export type VoiceTranscriptionResponse = {
  success: true;
  data: {
    transcript: string;
  };
};

export type SpeechStreamChunk = {
  success: true;
  data: {
    audioData: string;
    done: boolean;
    encoding: 'pcm_f32le';
    sampleRate: 24_000;
  };
};
