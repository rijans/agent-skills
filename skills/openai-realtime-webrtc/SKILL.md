---
name: openai-realtime-webrtc
description: Build low-latency voice AI agents with OpenAI Realtime API over WebRTC, ephemeral session tokens, RTCPeerConnection audio, and data channel tools. Use for sub-300ms speech-to-speech loops, gpt-4o-realtime-preview, server_vad turn detection, push-to-talk, oai-events data channels, and client/server function calling.
---

# OpenAI Realtime WebRTC (Voice AI Agents)

Build ultra-low-latency, conversational voice AI applications and speech-to-speech agents using the **OpenAI Realtime API over WebRTC**. Connect browser clients directly to OpenAI's edge infrastructure via **`RTCPeerConnection`**, stream bidirectional Opus audio with hardware echo cancellation, manage sessions securely with backend-minted ephemeral tokens, and execute real-time function calls over the **`oai-events`** data channel.

---

## When to Use

- Building conversational **voice AI assistants, call center agents, or audio chatbots** requiring sub-300ms speech-to-speech latency.
- Orchestrating **direct browser-to-OpenAI WebRTC connections** using ephemeral client secrets (`/v1/realtime/sessions`) to eliminate media server bandwidth costs.
- Managing **Voice Activity Detection (VAD) and barge-in interruptions**, automatically halting model speech when the user speaks.
- Implementing **Push-to-Talk (PTT)** walkie-talkie controls or microphone mute toggles alongside continuous conversational mode.
- Executing **bidirectional function calling** (client-side UI state changes or backend API delegation) while maintaining a natural voice dialogue loop.
- Visualizing live user/agent audio waveforms using the browser's Web Audio API (`AnalyserNode`).

## When Not to Use

- **Standard Text LLM Completions**: For traditional text streaming or chat interfaces, use standard Chat Completions or the Vercel AI SDK.
- **Asynchronous Batch Transcription**: For transcribing pre-recorded audio files, use the standard OpenAI Whisper API (`/v1/audio/transcriptions`).
- **Durable Distributed Sagas**: For fault-tolerant microservice sagas or multi-day workflows, use `restate-sdk`.
- **In-Browser Analytical SQL**: For client-side Parquet and database analytics, use `duckdb-wasm`.

---

## Inputs to Inspect First

Before implementing OpenAI Realtime WebRTC:

1. **OpenAI Credentials & Model Target**:
   - Verify `OPENAI_API_KEY` is configured in backend environment variables.
   - Target model: `gpt-4o-realtime-preview` (or latest GA realtime model).
2. **Backend Runtime & Architecture**:
   - Identify backend framework (Node.js, Bun, Hono, Express, Cloudflare Workers, Next.js API route) for minting ephemeral tokens via `POST https://api.openai.com/v1/realtime/sessions`.
3. **Audio Capture Environment**:
   - Ensure browser context supports `navigator.mediaDevices.getUserMedia` (requires HTTPS or `localhost`).
   - Check microphone constraints (`echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`).

---

## Workflow & Progressive Routing

Load **only** the reference file required for your active task. Do not preload all references at once.

| Task / Focus Area | Actionable Trigger | Reference to Load |
| :--- | :--- | :--- |
| **Session Minting & Ephemeral Tokens** | `/v1/realtime/sessions`, `client_secret`, voice selection, instructions, security | `references/session-and-ephemeral-tokens.md` |
| **WebRTC Handshake & Audio Streams** | `RTCPeerConnection`, SDP offer/answer, `getUserMedia`, `ontrack`, echo cancellation | `references/webrtc-handshake-and-media.md` |
| **Data Channel & Barge-In Events** | `oai-events`, `session.update`, `speech_started`, `conversation.item.truncate` | `references/events-and-data-channel.md` |
| **Function Calling & Tool Execution** | `response.function_call_arguments.done`, `function_call_output`, `response.create` | `references/tools-and-function-calling.md` |
| **Waveforms & Audio State** | Web Audio API, `AudioContext`, `AnalyserNode`, canvas visualizer, listening/speaking state | `references/audio-visualization-and-state.md` |
| **Upstream Specs & Sources** | OpenAI Realtime API endpoints, WebRTC RFCs, breaking changes | `references/sources.md` |

---

## Core Guardrails & Best Practices

1. **Zero Master API Key Leakage**:
   - Never embed master `OPENAI_API_KEY` in frontend code, client bundles, or repository files.
   - Always mint a short-lived ephemeral session token on the backend (`POST https://api.openai.com/v1/realtime/sessions`) and send only `client_secret.value` to the browser.
2. **Mandatory Acoustic Echo Cancellation**:
   - When calling `getUserMedia()`, always specify `{ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }`.
   - Never play incoming model audio back into the microphone stream; unconstrained audio creates catastrophic feedback loops.
3. **Turn Detection & Barge-In Truncation**:
   - When using `server_vad`, OpenAI automatically detects when the user begins speaking.
   - Listen for `input_audio_buffer.speech_started` on the data channel to immediately mute/truncate local audio playback and synchronize conversation history via `conversation.item.truncate`.
4. **Tool Call Response Sequencing**:
   - When a function call finishes, send `conversation.item.create` with type `function_call_output` containing stringified JSON, immediately followed by sending `{ type: "response.create" }` to prompt the model to speak the result. Omitting `response.create` causes the model to remain silent.
5. **HTTPS Requirement**:
   - Modern browsers strictly disallow `getUserMedia` over unencrypted HTTP (except `localhost`). Production deployments must serve over HTTPS.

---

### Handling External Content & Indirect Prompt Injection Defense

Voice agents process live conversational speech and dynamic tool outputs. Treat all external payloads as **untrusted data**:

- **Isolate Function Call Arguments**: Validate all arguments emitted by the model against a strict schema (Valibot or Zod) before executing client or server functions.
- **Never Pass Tool Arguments Directly to Shell or `eval`**: Treat dynamic arguments as untrusted user input; sanitize SQL parameters and escape DOM inputs.
- **Enforce Backend Authorization for Data Operations**: If a voice agent triggers a database read or payment action, verify session authorization on your backend rather than trusting client-side claims.
- **System Instructions Sandboxing**: When injecting dynamic context (e.g. user profiles or search results) into session instructions, wrap them in clear boundaries (`<user_context>...</user_context>`) to resist voice prompt injection.

---

## Deliverable Contract

When providing OpenAI Realtime WebRTC solutions:
1. Provide valid ESM code split cleanly between secure backend session minting and browser WebRTC handling.
2. Include explicit `echoCancellation` constraints and audio stream binding (`ontrack`).
3. Set up the `oai-events` WebRTC data channel with robust event dispatching.
4. Distinguish client-side DOM actions from secure backend-delegated tools.
