# Vinea Agricultural Operations Assistant

A responsive vineyard operations workspace with a continuous, turn-based voice
conversation powered by Mistral. One button starts voice mode: Vinea listens,
detects the end of the technician's turn, answers aloud, and resumes listening
until the technician says “basta” or stops the session.

The current voice implementation combines:

- Voxtral Mini Transcribe for reliable server-side Spanish transcription.
- A Mistral chat model for contextual multi-turn responses.
- Voxtral TTS with streamed PCM playback.

Voice mode is intentionally semi-duplex for demo reliability: microphone audio
is not sent while Vinea is speaking. Text remains available as a fallback. Tool
execution uses the parcel currently selected in the workspace.

## Agent actions

- `get_selected_parcel_context`: retrieves parcel metadata, active alerts,
  latest sensor readings and trends, recent weather, irrigation events, and
  locally saved inspection history. The chat shows a visible completion badge
  whenever Mistral invokes the action.

## Setup

```bash
pnpm install
cp .env.example .env.local
```

Add your Mistral API key to `.env.local`:

```text
MISTRAL_API_KEY=your-api-key
MISTRAL_MODEL=mistral-medium-3-5
MISTRAL_TRANSCRIPTION_MODEL=voxtral-mini-2602
MISTRAL_TRANSCRIPTION_LANGUAGE=es
MISTRAL_SPEECH_MODEL=voxtral-mini-tts-2603
MISTRAL_VOICE_ID=c69964a6-ab8b-4f8a-9465-ec0925096ec8
```

The configured fallback voice is the Mistral preset `Paul - Neutral`. Replace
`MISTRAL_VOICE_ID` to use another preset or a consented custom voice.

Recorded turns, chat, and speech synthesis all pass through server routes. The
long-lived Mistral API key never reaches the browser.

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
