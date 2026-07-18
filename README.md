# 🍇 Vinea – AI-Powered Vineyard Operations Assistant

Vinea transforms how vineyard technicians manage their daily operations by combining the natural flow of conversation with the precision of artificial intelligence. This isn't just a chat interface—it's a complete workspace where technicians can speak, analyze, document, and report on vineyard conditions using the full power of Mistral's language models.

---

## 🎯 What Vinea Does

Vinea is designed around the actual workflow of agricultural technicians. Instead of navigating complex menus or filling out forms, technicians simply speak or type their observations, questions, and commands. Vinea understands the context of your vineyard—each parcel, its sensors, recent weather, irrigation history, and active alerts—to provide guidance that's both intelligent and actionable.

The system doesn't just respond to queries; it actively helps technicians build a complete picture of their vineyard's health. From the moment a technician selects a parcel, Vinea provides relevant information and can guide them through inspection processes, evidence gathering, and report generation.

---

## ⚡ AI at the Core

Vinea leverages Mistral's cutting-edge AI models to deliver capabilities that would be impossible with traditional software:

| Feature | Description |
|---------|-------------|
| 🎤 **Natural Voice Interaction** | Powered by Mistral's Voxtral models, technicians can speak naturally in their preferred language. Vinea automatically detects when you've finished speaking, processes your request through Mistral's chat models, and responds aloud with context-aware answers. |
| 🧠 **Intelligent Evidence Synthesis** | Mistral's models analyze sensor readings, weather patterns, field notes, and observations to create coherent summaries and assessments that separate facts from interpretation. |
| 👁️ **Visual Intelligence** | Field photos are analyzed by Mistral's vision-capable models to provide structured observations and verification recommendations, correlated with your vineyard's data. |
| 🔧 **Context-Aware Tools** | Vinea's agent system uses Mistral models to determine when to retrieve parcel context, save inspection notes, or generate reports based on natural language intent. |

---

## 📋 Key Workflows

### 🌅 Morning Review
Start your day by reviewing AI-generated summaries of each parcel's status, with soil moisture trends, weather impacts, and recommended actions all synthesized from your sensor network.

### 👨🌾 Field Inspection
Select a parcel with concerning readings, speak your observations, and let Vinea guide you through a structured inspection process. Save field notes with observations, assessments, and uncertainty levels directly from your conversation.

### 📸 Evidence Analysis
Upload field photos and receive AI-powered analysis that helps you understand what you're seeing in the context of your vineyard's data.

### 📄 Report Generation
When an inspection is complete, ask Vinea to generate a professional PDF report with structured evidence from sensors, weather, field notes, and photos. Review the PDF preview, then confirm to send it via email with proper approval tokens.

---

## 🏗️ Built on Mistral

Every intelligent interaction in Vinea is powered by Mistral's AI platform. Transcriptions, chat responses, text-to-speech, and vision analysis all flow through Mistral's models, with Vinea providing the vineyard-specific context and workflow that makes these capabilities truly useful for agricultural technicians.

---

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
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=Vinea <onboarding@resend.dev>
REPORT_APPROVAL_SECRET=generate-a-long-random-secret
```

The configured fallback voice is the Mistral preset `Paul - Neutral`. Replace `MISTRAL_VOICE_ID` to use another preset or a consented custom voice.

Recorded turns, chat, and speech synthesis all pass through server routes. The long-lived Mistral API key never reaches the browser.

The report workflow generates a server-rendered PDF preview and requires an explicit confirmation before sending it to the canonical demo recipient. The Resend test sender can only deliver to an address authorized by the Resend account; use a verified domain sender for any other recipient.

Then start the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```
