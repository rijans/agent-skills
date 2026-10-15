# WebRTC Handshake, Audio Streams & Media Constraints

This guide explains how to establish an active WebRTC peer connection directly with OpenAI's Realtime gateway, configure microphone audio constraints to prevent acoustic feedback, and bind incoming model voice streams.

---

## 1. Complete WebRTC Handshake Sequence

```javascript
export async function connectRealtimeWebRTC(ephemeralToken) {
  // 1. Create a local WebRTC Peer Connection
  const pc = new RTCPeerConnection()

  // 2. Set up audio element for incoming model speech
  const audioEl = document.createElement('audio')
  audioEl.autoplay = true
  audioEl.style.display = 'none'
  document.body.appendChild(audioEl) // Required for Safari/WebKit media playback

  pc.ontrack = (event) => {
    console.log('[WebRTC] Incoming model audio track received')
    audioEl.srcObject = event.streams[0]
    audioEl.play().catch((err) => {
      console.warn('[WebRTC] Autoplay prevented:', err)
    })
  }

  // 3. Capture user microphone with mandatory hardware echo cancellation
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 24000,
    },
  })

  // 4. Attach microphone track to Peer Connection
  mediaStream.getTracks().forEach((track) => {
    pc.addTrack(track, mediaStream)
  })

  // 5. Establish the control data channel (must be named 'oai-events')
  const dataChannel = pc.createDataChannel('oai-events')

  // 6. Generate SDP Offer
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  // 7. Exchange SDP Offer directly with OpenAI edge gateway using ephemeral token
  const baseUrl = 'https://api.openai.com/v1/realtime'
  const model = 'gpt-4o-realtime-preview'
  const response = await fetch(`${baseUrl}?model=${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ephemeralToken}`,
      'Content-Type': 'application/sdp',
    },
    body: offer.sdp,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI WebRTC SDP exchange failed (${response.status}): ${errorText}`)
  }

  // 8. Receive and apply the SDP Answer from OpenAI
  const sdpAnswer = await response.text()
  await pc.setRemoteDescription({
    type: 'answer',
    sdp: sdpAnswer,
  })

  console.log('[WebRTC] Connection successfully established with OpenAI!')
  return { pc, dataChannel, audioEl, mediaStream }
}
```

---

## 2. Audio Constraints & Echo Cancellation

> [!CAUTION]
> If you call `navigator.mediaDevices.getUserMedia({ audio: true })` without hardware constraints, incoming model voice playing through the device speakers will be re-captured by the microphone. The model will hear itself, believe the user spoke, and continuously interrupt itself.

Always specify full acoustic constraints:

```javascript
const constraints = {
  audio: {
    echoCancellation: true,  // Eliminates speaker sound loop
    noiseSuppression: true,  // Filters ambient background noise
    autoGainControl: true,   // Normalizes speech volume
    channelCount: 1,         // Mono audio is standard for Opus speech
  },
}
```

---

## 3. Disconnection & Cleanup Lifecycle

When the user leaves the page or clicks "Disconnect", cleanly tear down all WebRTC tracks and hardware resources:

```javascript
export function disconnectSession({ pc, dataChannel, mediaStream, audioEl }) {
  // 1. Close data channel
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.close()
  }

  // 2. Stop microphone tracks (releases browser recording indicator)
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
  }

  // 3. Clear audio element
  if (audioEl) {
    audioEl.pause()
    audioEl.srcObject = null
    audioEl.remove()
  }

  // 4. Close Peer Connection
  if (pc) {
    pc.close()
  }

  console.log('[WebRTC] Cleaned up all tracks and closed peer connection')
}
```
