'use client';

import { useEffect, useRef, useState } from 'react';

import {
  createPcm16WavBlob,
  decodeBase64Audio,
  decodePcmFloat32,
  isSpeechStreamChunk,
  isStopVoiceCommand,
  isVoiceTranscriptionResponse,
} from '@/lib/audio/voice-conversation-utils';
import type { VoiceConversationState } from '@/types/voice-conversation';

const SPEECH_THRESHOLD = 0.012;
const SILENCE_DURATION_MS = 2_000;
const MAX_TURN_DURATION_MS = 30_000;
const REALTIME_SAMPLE_RATE = 16_000;
const TTS_SAMPLE_RATE = 24_000;

type UseVoiceConversationOptions = {
  onTurn: (transcript: string) => Promise<string>;
};

type WorkletAudioMessage = {
  type: 'audio';
  pcm: ArrayBuffer;
  rms: number;
};

function getApiErrorMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    typeof value.error === 'string'
  ) {
    return value.error;
  }

  return fallback;
}

function getMicrophoneError(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone access was denied. Allow it in the browser and try again.';
  }

  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone was found on this device.';
  }

  return error instanceof Error
    ? error.message
    : 'Voice mode could not access the microphone.';
}

export function useVoiceConversation({ onTurn }: UseVoiceConversationOptions) {
  const [state, setState] = useState<VoiceConversationState>('idle');
  const [isActive, setIsActive] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onTurnRef = useRef(onTurn);
  const stateRef = useRef<VoiceConversationState>('idle');
  const activeRef = useRef(false);
  const finishingTurnRef = useRef(false);
  const speechStartedRef = useRef(false);
  const consecutiveSpeechChunksRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const turnStartedAtRef = useRef(0);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const mutedGainRef = useRef<GainNode | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const currentSpeechSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scheduledSpeechSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextSpeechTimeRef = useRef(0);

  function transition(nextState: VoiceConversationState) {
    stateRef.current = nextState;
    setState(nextState);
  }

  function stopSpeechPlayback() {
    for (const source of scheduledSpeechSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // The source may have already ended.
      }
    }

    scheduledSpeechSourcesRef.current.clear();
    currentSpeechSourceRef.current = null;
    nextSpeechTimeRef.current = 0;
  }

  async function releaseAudioResources() {
    captureNodeRef.current?.disconnect();
    microphoneSourceRef.current?.disconnect();
    mutedGainRef.current?.disconnect();
    captureNodeRef.current = null;
    microphoneSourceRef.current = null;
    mutedGainRef.current = null;

    for (const track of mediaStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    mediaStreamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
    }
  }

  function resetTurnState() {
    finishingTurnRef.current = false;
    speechStartedRef.current = false;
    consecutiveSpeechChunksRef.current = 0;
    lastSpeechAtRef.current = 0;
    turnStartedAtRef.current = Date.now();
    audioChunksRef.current = [];
    setPartialTranscript('');
  }

  async function stopConversation(nextError?: string) {
    activeRef.current = false;
    setIsActive(false);
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    stopSpeechPlayback();
    resetTurnState();
    await releaseAudioResources();

    if (nextError) {
      setError(nextError);
      transition('error');
      return;
    }

    setError(null);
    transition('idle');
  }

  async function failConversation(errorMessage: string) {
    await stopConversation(errorMessage);
  }

  function finishListeningTurn() {
    if (finishingTurnRef.current || !speechStartedRef.current) {
      return;
    }

    finishingTurnRef.current = true;
    transition('transcribing');
    const audioChunks = audioChunksRef.current;
    audioChunksRef.current = [];
    void transcribeTurn(audioChunks);
  }

  async function transcribeTurn(audioChunks: Uint8Array[]) {
    try {
      const abortController = new AbortController();
      requestAbortRef.current = abortController;
      const formData = new FormData();
      formData.append(
        'audio',
        createPcm16WavBlob(audioChunks, REALTIME_SAMPLE_RATE),
        'voice-turn.wav',
      );
      const response = await fetch('/api/voice/transcription', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });
      const payload: unknown = await response.json();
      requestAbortRef.current = null;

      if (!response.ok || !isVoiceTranscriptionResponse(payload)) {
        throw new Error(
          getApiErrorMessage(
            payload,
            'Vinea could not transcribe that recording.',
          ),
        );
      }

      await handleCompletedTranscript(payload.data.transcript);
    } catch (transcriptionError) {
      if (
        transcriptionError instanceof DOMException &&
        transcriptionError.name === 'AbortError'
      ) {
        return;
      }

      await failConversation(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : 'The voice turn could not be transcribed. Please try again.',
      );
    }
  }

  async function playSpeech(text: string) {
    const audioContext = audioContextRef.current;

    if (!audioContext) {
      throw new Error('The audio output is unavailable.');
    }

    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    const response = await fetch('/api/voice/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      const payload: unknown = await response.json().catch(() => null);
      throw new Error(
        getApiErrorMessage(
          payload,
          'Vinea could not generate speech. Please try again.',
        ),
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pendingText = '';
    let finalSource: AudioBufferSourceNode | null = null;
    nextSpeechTimeRef.current = audioContext.currentTime + 0.08;

    while (activeRef.current) {
      const { done, value } = await reader.read();
      pendingText += decoder.decode(value, { stream: !done });
      const lines = pendingText.split('\n');
      pendingText = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const payload: unknown = JSON.parse(line);
        if (!isSpeechStreamChunk(payload)) {
          throw new Error('Vinea returned an invalid speech stream.');
        }

        if (payload.data.audioData) {
          const bytes = decodeBase64Audio(payload.data.audioData);
          const samples = decodePcmFloat32(bytes);
          const buffer = audioContext.createBuffer(
            1,
            samples.length,
            TTS_SAMPLE_RATE,
          );
          buffer.copyToChannel(samples, 0);
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          scheduledSpeechSourcesRef.current.add(source);
          currentSpeechSourceRef.current = source;
          source.onended = () => {
            scheduledSpeechSourcesRef.current.delete(source);
            if (currentSpeechSourceRef.current === source) {
              currentSpeechSourceRef.current = null;
            }
          };
          const startAt = Math.max(
            audioContext.currentTime + 0.02,
            nextSpeechTimeRef.current,
          );
          source.start(startAt);
          nextSpeechTimeRef.current = startAt + buffer.duration;
          finalSource = source;
        }
      }

      if (done) {
        break;
      }
    }

    requestAbortRef.current = null;

    if (finalSource && activeRef.current) {
      await new Promise<void>((resolve) => {
        const remainingMilliseconds = Math.max(
          0,
          (nextSpeechTimeRef.current - audioContext.currentTime) * 1000,
        );
        setTimeout(resolve, remainingMilliseconds + 40);
      });
    }
  }

  async function handleCompletedTranscript(rawTranscript: string) {
    const transcript = rawTranscript.trim();

    if (!activeRef.current) {
      return;
    }

    if (!transcript) {
      beginListeningTurn();
      return;
    }

    setPartialTranscript(transcript);

    if (isStopVoiceCommand(transcript)) {
      await stopConversation();
      return;
    }

    transition('thinking');

    try {
      const answer = await onTurnRef.current(transcript);
      if (!activeRef.current) {
        return;
      }

      transition('speaking');
      await playSpeech(answer);

      if (activeRef.current) {
        beginListeningTurn();
      }
    } catch (turnError) {
      if (
        turnError instanceof DOMException &&
        turnError.name === 'AbortError'
      ) {
        return;
      }

      await failConversation(
        turnError instanceof Error
          ? turnError.message
          : 'The voice turn failed. Please try again.',
      );
    }
  }

  function beginListeningTurn() {
    if (!activeRef.current) {
      return;
    }

    resetTurnState();
    transition('listening');
  }

  function handleWorkletMessage(message: MessageEvent<WorkletAudioMessage>) {
    if (
      message.data.type !== 'audio' ||
      stateRef.current !== 'listening' ||
      !activeRef.current
    ) {
      return;
    }

    audioChunksRef.current.push(new Uint8Array(message.data.pcm));

    const now = Date.now();
    const isSpeech = message.data.rms >= SPEECH_THRESHOLD;

    if (isSpeech) {
      consecutiveSpeechChunksRef.current += 1;
      lastSpeechAtRef.current = now;
      if (consecutiveSpeechChunksRef.current >= 2) {
        speechStartedRef.current = true;
      }
    } else {
      consecutiveSpeechChunksRef.current = 0;
    }

    if (!speechStartedRef.current && audioChunksRef.current.length > 25) {
      audioChunksRef.current.shift();
    }

    if (
      speechStartedRef.current &&
      now - lastSpeechAtRef.current >= SILENCE_DURATION_MS
    ) {
      finishListeningTurn();
      return;
    }

    if (now - turnStartedAtRef.current >= MAX_TURN_DURATION_MS) {
      finishListeningTurn();
    }
  }

  async function startConversation() {
    if (activeRef.current) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) {
      setError('This browser does not support voice conversations.');
      transition('error');
      return;
    }

    setError(null);
    transition('connecting');

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const audioContext = new AudioContext();
      await audioContext.audioWorklet.addModule(
        '/audio/pcm-capture-processor.js',
      );
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const captureNode = new AudioWorkletNode(
        audioContext,
        'pcm-capture-processor',
      );
      const mutedGain = audioContext.createGain();
      mutedGain.gain.value = 0;
      captureNode.port.onmessage = handleWorkletMessage;
      source.connect(captureNode);
      captureNode.connect(mutedGain);
      mutedGain.connect(audioContext.destination);
      mediaStreamRef.current = mediaStream;
      audioContextRef.current = audioContext;
      microphoneSourceRef.current = source;
      captureNodeRef.current = captureNode;
      mutedGainRef.current = mutedGain;
      activeRef.current = true;
      setIsActive(true);
      beginListeningTurn();
    } catch (startError) {
      await failConversation(getMicrophoneError(startError));
    }
  }

  async function toggleConversation() {
    if (activeRef.current) {
      await stopConversation();
      return;
    }

    await startConversation();
  }

  useEffect(() => {
    onTurnRef.current = onTurn;
  }, [onTurn]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      requestAbortRef.current?.abort();
      stopSpeechPlayback();
      void releaseAudioResources();
    };
  }, []);

  return {
    error,
    isActive,
    partialTranscript,
    state,
    stopConversation,
    toggleConversation,
  };
}
