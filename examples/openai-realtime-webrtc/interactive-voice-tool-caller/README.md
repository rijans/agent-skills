# Interactive Voice Agent with Function Calling & WebRTC

A runnable Node.js and browser example demonstrating real-time bidirectional function calling, animated audio visualization, and server-delegated database lookups with the **OpenAI Realtime API over WebRTC**.

---

## Architecture & Features

```text
[User Speaks]: "What is the status of flight AA-100?"
       │
       ▼ (Direct WebRTC Audio)
[OpenAI Edge Model] ───(oai-events Data Channel)───► response.function_call_arguments.done
                                                              │
                                       ┌──────────────────────┴──────────────────────┐
                                       ▼                                             ▼
                                Client-Side Tool                              Server-Delegated Tool
                                (`change_theme`)                             (`check_flight_status`)
                                       │                                             │
                               Updates DOM State                             Fetches /api/flights/AA-100
                                       │                                             │
                                       └──────────────────────┬──────────────────────┘
                                                              ▼
                                              conversation.item.create (output)
                                                              │
                                                              ▼
                                                       response.create
                                                              │
                                                              ▼
                                                  Model Speaks the Result!
```

1. **Client-Side Tools**: Voice-controlled theme changes (`change_theme`) directly altering DOM styles without backend roundtrips.
2. **Server-Delegated Tools**: Flight status queries (`check_flight_status`) routed to a protected backend database API (`/api/flights/:id`).
3. **Canvas Waveform Visualizer**: Live rendering of frequency data using the browser's Web Audio API `AnalyserNode`.
4. **Seamless Speech Resumption**: Closes every tool call with `response.create` so the agent verbally answers.

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
The server starts at `http://localhost:3001`.

### 3. Open in Browser & Try These Commands

1. Open `http://localhost:3001` in your browser.
2. Click **Start Agent** and allow microphone access.
3. **Try Client-Side Tool**: Say *"Can you make the theme cyberpunk?"* or *"Switch to emerald mode"*. Notice the UI theme updates immediately.
4. **Try Database Tool**: Say *"Can you check the status of flight AA-100?"*. The agent queries the database and speaks the gate status while the flight card updates.
