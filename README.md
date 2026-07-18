# Mistral Agricultural Assistant

A minimal voice chat built with Next.js, shadcn/ui, the Mistral Conversations
API, Voxtral realtime transcription, and Voxtral text-to-speech.

Selecting the microphone starts conversation mode. It detects one second of
silence, sends the completed voice turn, speaks the answer, and starts listening
again. The conversation-mode switch can end the continuous session.

The current session is kept only in browser memory. Requests use `store: false`,
so the application does not provide persistent conversation history.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Add your Mistral API key to `.env.local`:

```text
MISTRAL_API_KEY=your-api-key
MISTRAL_MODEL=mistral-small-latest
MISTRAL_TRANSCRIPTION_MODEL=voxtral-mini-latest
MISTRAL_REALTIME_TRANSCRIPTION_MODEL=voxtral-mini-transcribe-realtime-2602
MISTRAL_SPEECH_MODEL=voxtral-mini-tts-2603
MISTRAL_VOICE_ID=c69964a6-ab8b-4f8a-9465-ec0925096ec8
```

The default voice is the Mistral preset `Paul - Neutral`. Replace
`MISTRAL_VOICE_ID` to use another preset or custom voice.

The browser receives only a short-lived, model-scoped realtime token. The
long-lived Mistral API key remains on the server.

Then start the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```
