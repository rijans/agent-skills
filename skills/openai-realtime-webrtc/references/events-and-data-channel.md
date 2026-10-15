# Data Channel Events, Speech Streaming & Barge-In

The WebRTC Data Channel (named **`oai-events`**) acts as the bidirectional control plane for text streaming, session updates, user transcription, function calling, and interruption synchronization.

---

## 1. Setting Up the Event Listener

```javascript
dataChannel.onopen = () => {
  console.log('[DataChannel] oai-events channel open and ready')
}

dataChannel.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data)
    handleRealtimeEvent(msg)
  } catch (err) {
    console.error('[DataChannel] Failed to parse event JSON:', err)
  }
}
```

---

## 2. Core Server-to-Client Events

| Event Type | Description | Key Payload Fields |
| :--- | :--- | :--- |
| `input_audio_buffer.speech_started` | Server VAD detected user speech. **Primary trigger for barge-in interruption**. | `audio_start_ms`, `item_id` |
| `input_audio_buffer.speech_stopped` | User stopped speaking; server is processing user turn. | `audio_end_ms`, `item_id` |
| `conversation.item.input_audio_transcription.completed` | Live Whisper transcription of user speech. | `transcript`, `item_id` |
| `response.audio_transcript.delta` | Streaming text chunks of what the model is currently speaking. | `delta`, `response_id`, `item_id` |
| `response.function_call_arguments.done` | Model completed function call arguments; ready for client execution. | `call_id`, `name`, `arguments` |
| `response.done` | Model finished generating the current turn. | `response.status`, `usage` |
| `error` | Server returned an error. | `error.message`, `error.code` |

---

## 3. Core Client-to-Server Events

### A. Updating Session Dynamically (`session.update`)

Change voice, instructions, or turn detection parameters on the fly without reconnecting:

```javascript
function updateVoice(dataChannel, newVoice) {
  dataChannel.send(
    JSON.stringify({
      type: 'session.update',
      session: {
        voice: newVoice, // e.g. 'ash', 'coral', 'verse'
      },
    })
  )
}
```

### B. Manually Triggering a Response (`response.create`)

Tell the model to speak or acknowledge a recent event:

```javascript
function triggerResponse(dataChannel) {
  dataChannel.send(
    JSON.stringify({
      type: 'response.create',
    })
  )
}
```

### C. Canceling Current Output (`response.cancel`)

Immediately abort model speech generation:

```javascript
function cancelCurrentResponse(dataChannel) {
  dataChannel.send(
    JSON.stringify({
      type: 'response.cancel',
    })
  )
}
```

---

## 4. Handling Barge-In & Interruption Truncation

When using `server_vad`, OpenAI automatically stops sending new audio packets over WebRTC when the user speaks. However, **the browser's local audio element may still have several hundred milliseconds of audio buffered in its playback queue**.

> [!WARNING]
> **Never set `audioElement.currentTime = 0` on a WebRTC live stream**. In browser specifications, `MediaStream` objects have indefinite duration (`Infinity`) and are non-seekable. Assigning `currentTime = 0` throws an `InvalidStateError` DOMException (`"The element's source is a stream"`). Call `.pause()` to silence immediately, and resume with `.play()` on the next turn.

To ensure a seamless, non-overlapping interruption experience:

```javascript
let currentModelItemId = null
let currentAudioElement = null

function handleRealtimeEvent(msg) {
  switch (msg.type) {
    // 1. Track current speaking item
    case 'response.audio.delta':
      currentModelItemId = msg.item_id
      break

    // 2. User started speaking! Interrupt model immediately
    case 'input_audio_buffer.speech_started': {
      console.log('[Barge-In] User interrupted model speech')

      // A. Mute/pause local browser audio immediately
      if (currentAudioElement) {
        currentAudioElement.pause()
      }

      // B. Cancel further model generation
      dataChannel.send(JSON.stringify({ type: 'response.cancel' }))

      // C. Truncate conversation history to avoid replay desync
      if (currentModelItemId) {
        dataChannel.send(
          JSON.stringify({
            type: 'conversation.item.truncate',
            item_id: currentModelItemId,
            content_index: 0,
            audio_end_ms: msg.audio_start_ms || 0,
          })
        )
      }
      break
    }

    // 3. Display live user speech transcript
    case 'conversation.item.input_audio_transcription.completed':
      console.log(`[User Said]: ${msg.transcript}`)
      appendTranscriptToUI('user', msg.transcript)
      break

    // 4. Display live model speech transcript & resume audio if paused
    case 'response.audio_transcript.delta':
      if (currentAudioElement && currentAudioElement.paused) {
        currentAudioElement.play().catch((err) => {
          console.warn('[WebRTC] Audio resume error:', err)
        })
      }
      appendTranscriptChunkToUI('assistant', msg.delta)
      break
  }
}
```
