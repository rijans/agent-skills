# OpenAI Realtime WebRTC Voice Assistant

A runnable, zero-dependency Node.js and browser example demonstrating speech-to-speech conversational AI with the **OpenAI Realtime API over WebRTC**.

---

## Key Highlights

- **Zero API Key Leakage**: Master `OPENAI_API_KEY` stays on the server; the browser connects using temporary ephemeral session tokens (`client_secret.value`).
- **Direct WebRTC P2P**: Audio streams directly between the browser and OpenAI edge servers (<300ms latency) without consuming server bandwidth.
- **Hardware Echo Cancellation**: Configures `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }` to prevent audio feedback.
- **Automatic Barge-In**: Listens for `input_audio_buffer.speech_started` on the `oai-events` data channel to pause local playback when the user interrupts.

---

## Quickstart

### 1. Set your OpenAI API Key

```bash
export OPENAI_API_KEY="sk-proj-..."
```

### 2. Start the Application

```bash
npm start
```
The server starts at `http://localhost:3000`.

### 3. Open in Browser & Speak

1. Open `http://localhost:3000` in Google Chrome, Edge, Brave, or Safari.
2. Click **Connect Voice** and allow microphone access when prompted.
3. Start speaking naturally! The model responds with voice audio and streams the live transcript into the UI.
4. Try interrupting the model while it is speaking to observe automatic barge-in.
