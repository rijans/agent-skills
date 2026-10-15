# Session Minting & Ephemeral Client Tokens

This guide covers creating ephemeral session tokens on the backend using the OpenAI Realtime REST API, configuring model parameters, and securely distributing client credentials to browser WebRTC clients.

---

## 1. Why Ephemeral Tokens are Mandatory

Connecting browser WebRTC clients directly to OpenAI offers the lowest possible latency (<300ms) and zero server audio-bandwidth overhead. However, **the browser must never receive your master `OPENAI_API_KEY`**.

Instead, your application backend mints an **ephemeral client token** with a short TTL (typically 1 minute to establish the connection):

```text
Browser Client                     Your Backend Server                OpenAI Realtime API
      │                                     │                                  │
      │── 1. GET /api/realtime-session ────►│                                  │
      │                                     │── 2. POST /v1/realtime/sessions ─►│
      │                                     │      (with master OPENAI_KEY)    │
      │                                     │                                  │
      │                                     │◄── 3. Returns client_secret ─────│
      │◄── 4. Returns ephemeral token ──────│                                  │
      │                                                                        │
      │────── 5. Direct WebRTC SDP Handshake (Bearer <ephemeral_token>) ──────►│
```

---

## 2. Session Configuration Options

When calling `POST https://api.openai.com/v1/realtime/sessions`, you can configure default session parameters:

```typescript
export interface RealtimeSessionConfig {
  model?: 'gpt-4o-realtime-preview' | string
  modalities?: Array<'audio' | 'text'>
  instructions?: string
  voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse'
  input_audio_format?: 'pcm16' | 'g711_ulaw' | 'g711_alaw'
  output_audio_format?: 'pcm16' | 'g711_ulaw' | 'g711_alaw'
  input_audio_transcription?: {
    model: 'whisper-1'
  }
  turn_detection?: {
    type: 'server_vad'
    threshold?: number // default 0.5 (0.0 to 1.0)
    prefix_padding_ms?: number // default 300
    silence_duration_ms?: number // default 500
  } | null
  tools?: Array<{
    type: 'function'
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string }
  temperature?: number
  max_response_output_tokens?: number | 'inf'
}
```

---

## 3. Backend Implementations

### A. Node.js Native HTTP / Express Handler

```javascript
import express from 'express'

const app = express()
app.use(express.json())

app.post('/api/realtime-session', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY on server' })
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'coral',
        instructions: 'You are a friendly, concise voice AI pair programmer.',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(response.status).json({ error: errText })
    }

    const data = await response.json()
    // Return the ephemeral secret token to the browser
    res.json(data)
  } catch (err) {
    console.error('Session creation failed:', err)
    res.status(500).json({ error: err.message })
  }
})
```

### B. Next.js App Router Route Handler (`app/api/session/route.ts`)

```typescript
import { NextResponse } from 'next/server'

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 })
  }

  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-realtime-preview',
      voice: 'verse',
      instructions: 'You are an intelligent voice assistant.',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    return NextResponse.json({ error: err }, { status: response.status })
  }

  const sessionData = await response.json()
  return NextResponse.json(sessionData)
}
```

### C. Cloudflare Workers / Hono Handler

```typescript
import { Hono } from 'hono'

type Bindings = { OPENAI_API_KEY: string }
const app = new Hono<{ Bindings: Bindings }>()

app.post('/api/session', async (c) => {
  const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy',
    }),
  })

  const data = await res.json()
  return c.json(data, res.status as any)
})

export default app
```

---

## 4. What the Browser Receives

The response object contains:
```json
{
  "id": "sess_001ABC123",
  "object": "realtime.session",
  "model": "gpt-4o-realtime-preview",
  "client_secret": {
    "value": "ek_001XYZ987...",
    "expires_at": 1729000000
  }
}
```
The browser uses `client_secret.value` as the `Bearer` token in the subsequent WebRTC SDP handshake.
