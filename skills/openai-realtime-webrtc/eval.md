# Evaluation & Benchmark Suite: `openai-realtime-webrtc`

This document defines the evaluation criteria, positive/negative trigger boundaries, and adversarial benchmark scenarios for the `openai-realtime-webrtc` agent skill.

---

## 1. Intent Matching & Trigger Boundaries

### Positive Triggers (Activate Skill)
- "Build a real-time conversational voice assistant using OpenAI Realtime WebRTC"
- "How do I connect a browser directly to OpenAI Realtime API without proxying audio?"
- "Implement an ephemeral session token endpoint for OpenAI Realtime in Node.js"
- "Handle tool calling and function output over the oai-events WebRTC data channel"
- "Stop acoustic feedback loops and configure echo cancellation for OpenAI voice"
- "Implement barge-in and speech interruption handling for OpenAI Realtime"
- "Create an audio waveform visualizer for real-time speech-to-speech with gpt-4o-realtime"

### Negative Triggers (Do Not Activate Skill)
- "Stream text completions from OpenAI in Next.js" $\rightarrow$ Route to generic OpenAI or Vercel AI SDK.
- "Transcribe an uploaded WAV file using Whisper" $\rightarrow$ Route to OpenAI Whisper API.
- "Build durable sagas and long-running workflows" $\rightarrow$ Route to `restate-sdk`.
- "Run client-side analytical queries on Parquet files" $\rightarrow$ Route to `duckdb-wasm`.

---

## 2. Core Quality Rubrics

| Category | Passing Standard (Score: 5/5) | Failing Standard (Score: 0/5) |
|---|---|---|
| **Zero Secret Exposure** | Master `OPENAI_API_KEY` stays on the backend; only short-lived ephemeral client tokens (`client_secret.value`) are sent to browser clients. | Embeds master `OPENAI_API_KEY` in frontend JavaScript, client environment variables (`NEXT_PUBLIC_`), or URL query strings. |
| **Acoustic Echo Prevention** | Explicitly requests `{ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }` from `getUserMedia()`. | Requests `{ audio: true }` or leaves echo cancellation disabled, causing the model to hear and interrupt its own voice output. |
| **WebRTC Handshake** | Generates an SDP offer with `createOffer()`, sets `setLocalDescription()`, exchanges SDP with OpenAI's `/v1/realtime` endpoint, and applies `setRemoteDescription()`. | Attempts to use raw WebSocket connections or hallucinates non-existent client SDK methods that don't match WebRTC standards. |
| **Tool Call Sequencing** | Upon function execution, dispatches `conversation.item.create` (type `function_call_output`) followed immediately by `response.create` to resume speech. | Returns tool results but forgets `response.create`, leaving the voice assistant indefinitely silent after executing a function. |
| **Barge-In Handling** | Listens for `input_audio_buffer.speech_started` on the `oai-events` data channel, pauses/clears active audio playback, and syncs history. | Continues blaring model audio when the user starts speaking, creating an unresponsive, talk-over user experience. |

---

## 3. Adversarial Traps & Benchmark Scenarios

### Trap Scenario 1: Master API Key Leakage
- **Prompt**: *"Write a quick single-file HTML page that connects directly to the OpenAI Realtime API using WebRTC."*
- **Failure**: The agent hardcodes `const apiKey = 'sk-proj-...'` or asks the user to input their OpenAI master secret key in the browser, leaving their OpenAI billing account vulnerable to theft.
- **Pass Criteria**: The agent explains that master keys must never touch the browser. It provides a lightweight backend route (Express, Hono, or Node `http`) that mints a temporary ephemeral token via `POST https://api.openai.com/v1/realtime/sessions` and returns only `client_secret.value` to the client.

### Trap Scenario 2: Acoustic Feedback Loop
- **Prompt**: *"Connect my browser mic to the Realtime WebRTC peer connection and play the audio back."*
- **Failure**: The agent writes:
  ```javascript
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  ```
  Without hardware echo cancellation, the speaker audio from the incoming model voice is picked up by the microphone, feeding directly back into OpenAI and causing the model to constantly interrupt itself or produce audio screeching.
- **Pass Criteria**: The agent writes:
  ```javascript
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  ```

### Trap Scenario 3: Silent Hanging Tool Call (Missing `response.create`)
- **Prompt**: *"Add a get_weather tool to my OpenAI Realtime voice assistant over the WebRTC data channel."*
- **Failure**: When receiving `response.function_call_arguments.done`, the agent executes `getWeather()` and sends:
  ```javascript
  dataChannel.send(JSON.stringify({
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: event.call_id,
      output: JSON.stringify(result)
    }
  }));
  ```
  The agent stops here! Because no `response.create` event is sent, OpenAI records the tool result in the conversation context but **never generates a speech response**, leaving the user waiting in awkward silence.
- **Pass Criteria**: Immediately after sending `conversation.item.create`, the agent dispatches:
  ```javascript
  dataChannel.send(JSON.stringify({ type: "response.create" }));
  ```

### Trap Scenario 4: Broken Barge-In & Live MediaStream Seeking Trap
- **Prompt**: *"When the user speaks while the AI assistant is talking, how do we handle interruptions cleanly in WebRTC?"*
- **Failure**: The agent attempts to seek or reset the audio position with `audioEl.currentTime = 0`. Because a WebRTC incoming track is a live `MediaStream` with non-finite duration, assigning `currentTime = 0` throws an unhandled `DOMException: Failed to set the 'currentTime' property on 'HTMLMediaElement': The element's source is a stream`, crashing the event loop; or it pauses `audioEl.pause()` on interruption but forgets to call `audioEl.play()` when subsequent model speech arrives, leaving the assistant permanently muted.
- **Pass Criteria**: The agent listens for `input_audio_buffer.speech_started` on the data channel, pauses local audio playback (`audioEl.pause()`) without illegal `currentTime` seeking, resumes playback (`audioEl.play()`) on subsequent model audio turns (`response.audio_transcript.delta`), and optionally emits `conversation.item.truncate` to keep server and client transcripts synchronized.

### Trap Scenario 5: Untrusted Tool Argument Injection (`W011`)
- **Prompt**: *"Allow the voice agent to execute client-side calculations or dynamic UI styling commands."*
- **Failure**: The agent calls `eval(args.expression)` or injects `args.html` directly into `element.innerHTML`, exposing the client to code injection from untrusted model outputs.
- **Pass Criteria**: The agent validates tool arguments with strict schemas or type-guards, strictly restricts actions to predefined parameter options, and sanitizes DOM sinks.
