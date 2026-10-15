# Audio Visualization, Conversational States & Push-to-Talk

This guide covers real-time audio waveform visualization using the Web Audio API, managing the conversational state machine, and implementing a Push-to-Talk (PTT) walkie-talkie mode.

---

## 1. Web Audio API & Waveform Visualization

To render an animated audio visualizer for incoming model voice or outgoing user speech:

```javascript
export async function createAudioVisualizer(mediaStream, canvasElement) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume()
  }
  const source = audioCtx.createMediaStreamSource(mediaStream)
  const analyser = audioCtx.createAnalyser()

  analyser.fftSize = 64 // 32 frequency bins
  source.connect(analyser)

  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  const canvasCtx = canvasElement.getContext('2d')

  let animationId = null

  function draw() {
    animationId = requestAnimationFrame(draw)

    analyser.getByteFrequencyData(dataArray)

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height)

    const barWidth = (canvasElement.width / bufferLength) * 1.5
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvasElement.height

      canvasCtx.fillStyle = '#10b981' // emerald green
      canvasCtx.fillRect(
        x,
        canvasElement.height - barHeight,
        barWidth - 2,
        barHeight
      )

      x += barWidth
    }
  }

  draw()

  return {
    stop: () => {
      if (animationId) cancelAnimationFrame(animationId)
      source.disconnect()
      audioCtx.close()
    },
  }
}
```

---

## 2. Conversational State Machine

A voice assistant cycles through five distinct states:

```text
┌──────────────┐     connect()      ┌──────────────┐
│ DISCONNECTED │ ──────────────────►│  CONNECTING  │
└──────────────┘                    └──────┬───────┘
                                           │ WebRTC ready
                                           ▼
                                    ┌──────────────┐
                    ┌──────────────►│  LISTENING   │◄─────────────┐
                    │               └──────┬───────┘              │
                    │                      │ user stops speaking  │
                    │                      ▼                      │
                    │               ┌──────────────┐              │
     interruption   │               │   THINKING   │              │
     (barge-in)     │               └──────┬───────┘              │
                    │                      │ response.audio       │
                    │                      ▼                      │
                    │               ┌──────────────┐              │
                    └───────────────┤   SPEAKING   ├──────────────┘
                                    └──────────────┘ response.done
```

### State Event Map

```javascript
let currentState = 'DISCONNECTED'

function setState(newState) {
  currentState = newState
  document.getElementById('status-indicator').textContent = newState
  document.body.setAttribute('data-state', newState.toLowerCase())
}

function handleStateEvents(msg) {
  switch (msg.type) {
    case 'input_audio_buffer.speech_started':
      setState('LISTENING')
      break
    case 'input_audio_buffer.speech_stopped':
      setState('THINKING')
      break
    case 'response.audio.delta':
      if (currentState !== 'SPEAKING') setState('SPEAKING')
      break
    case 'response.done':
      setState('LISTENING')
      break
  }
}
```

---

## 3. Push-to-Talk (PTT) Mode

In loud environments (offices, trade shows, factories), continuous Server VAD can trigger accidentally. You can switch to Push-to-Talk mode by disabling automatic turn detection:

### Step 1: Disable Server VAD on Session Update
```javascript
dataChannel.send(
  JSON.stringify({
    type: 'session.update',
    session: {
      turn_detection: null, // Disables automatic server-side VAD
    },
  })
)
```

### Step 2: Implement Push-to-Talk Button Listeners
```javascript
const micTrack = mediaStream.getAudioTracks()[0]
micTrack.enabled = false // Muted by default

const pttButton = document.getElementById('ptt-button')

// Mouse / Touch Press: Unmute & Start Recording
pttButton.addEventListener('mousedown', () => {
  micTrack.enabled = true
  console.log('[PTT] Mic active')
})

// Mouse / Touch Release: Commit Buffer & Request Response
pttButton.addEventListener('mouseup', () => {
  micTrack.enabled = false
  console.log('[PTT] Mic muted; committing speech buffer')

  // 1. Commit recorded audio buffer
  dataChannel.send(
    JSON.stringify({
      type: 'input_audio_buffer.commit',
    })
  )

  // 2. Instruct model to respond
  dataChannel.send(
    JSON.stringify({
      type: 'response.create',
    })
  )
})
```
