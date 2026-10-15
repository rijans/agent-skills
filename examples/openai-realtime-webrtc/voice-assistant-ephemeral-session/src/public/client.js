let peerConnection = null
let dataChannel = null
let localMediaStream = null
let audioElement = null
let currentAssistantMsgEl = null

const connectBtn = document.getElementById('connectBtn')
const disconnectBtn = document.getElementById('disconnectBtn')
const micToggleBtn = document.getElementById('micToggleBtn')
const statusPill = document.getElementById('statusPill')
const transcriptFeed = document.getElementById('transcriptFeed')

function updateStatus(text, state) {
  statusPill.textContent = text
  if (state) {
    statusPill.setAttribute('data-state', state)
  } else {
    statusPill.removeAttribute('data-state')
  }
}

function appendMessage(role, text) {
  // Clear placeholder if present
  const placeholder = transcriptFeed.querySelector('.placeholder-text')
  if (placeholder) placeholder.remove()

  const msgDiv = document.createElement('div')
  msgDiv.className = `msg msg-${role}`
  msgDiv.textContent = text
  transcriptFeed.appendChild(msgDiv)
  transcriptFeed.scrollTop = transcriptFeed.scrollHeight
  return msgDiv
}

async function startSession() {
  updateStatus('Connecting...', 'connecting')
  connectBtn.disabled = true

  try {
    // 1. Fetch ephemeral session token from our server
    const tokenRes = await fetch('/api/session', { method: 'POST' })
    if (!tokenRes.ok) {
      const err = await tokenRes.json()
      throw new Error(err.error || 'Failed to mint session token from server')
    }
    const sessionData = await tokenRes.json()
    const ephemeralKey = sessionData.client_secret?.value
    if (!ephemeralKey) {
      throw new Error('Server response missing client_secret.value')
    }

    // 2. Setup WebRTC Peer Connection
    peerConnection = new RTCPeerConnection()

    // Setup audio element for incoming model speech
    audioElement = document.createElement('audio')
    audioElement.autoplay = true
    peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Incoming model audio track received')
      audioElement.srcObject = event.streams[0]
    }

    // 3. Capture microphone with mandatory echo cancellation
    localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    // Attach mic track to peer connection
    localMediaStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localMediaStream)
    })

    // 4. Create control data channel
    dataChannel = peerConnection.createDataChannel('oai-events')

    dataChannel.onopen = () => {
      console.log('[WebRTC] oai-events channel open')
      updateStatus('Connected & Listening', 'connected')
      disconnectBtn.disabled = false
      micToggleBtn.disabled = false
    }

    dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        handleRealtimeEvent(msg)
      } catch (err) {
        console.error('[WebRTC] Failed to parse message JSON:', err)
      }
    }

    // 5. Generate SDP Offer
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    // 6. Direct SDP exchange with OpenAI Realtime API using ephemeral token
    const baseUrl = 'https://api.openai.com/v1/realtime'
    const model = 'gpt-4o-realtime-preview'
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    })

    if (!sdpResponse.ok) {
      const errorText = await sdpResponse.text()
      throw new Error(`OpenAI SDP exchange error: ${errorText}`)
    }

    const sdpAnswer = await sdpResponse.text()
    await peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: sdpAnswer,
    })

    console.log('[WebRTC] Handshake complete!')
  } catch (err) {
    console.error('[WebRTC] Connection failed:', err)
    alert(`Connection Error: ${err.message}`)
    cleanup()
  }
}

function handleRealtimeEvent(msg) {
  switch (msg.type) {
    // 1. User Speech Started: Barge-in interruption
    case 'input_audio_buffer.speech_started':
      console.log('[Barge-In] User interrupted model speech')
      updateStatus('User Speaking...', 'listening')
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
      currentAssistantMsgEl = null
      break

    // 2. User Speech Stopped
    case 'input_audio_buffer.speech_stopped':
      updateStatus('Thinking...', 'connected')
      break

    // 3. User Transcript Received
    case 'conversation.item.input_audio_transcription.completed':
      if (msg.transcript && msg.transcript.trim()) {
        appendMessage('user', msg.transcript.trim())
      }
      break

    // 4. Model Streaming Transcript
    case 'response.audio_transcript.delta':
      updateStatus('Model Speaking...', 'speaking')
      if (!currentAssistantMsgEl) {
        currentAssistantMsgEl = appendMessage('assistant', '')
      }
      currentAssistantMsgEl.textContent += msg.delta
      transcriptFeed.scrollTop = transcriptFeed.scrollHeight
      break

    // 5. Model Turn Complete
    case 'response.done':
      updateStatus('Listening...', 'connected')
      currentAssistantMsgEl = null
      break

    // 6. Server Error
    case 'error':
      console.error('[OpenAI Error]', msg.error)
      appendMessage('assistant', `[Error: ${msg.error?.message || 'Server error'}]`)
      break
  }
}

function toggleMic() {
  if (!localMediaStream) return
  const audioTrack = localMediaStream.getAudioTracks()[0]
  if (!audioTrack) return

  audioTrack.enabled = !audioTrack.enabled
  if (audioTrack.enabled) {
    micToggleBtn.textContent = 'Mute Mic'
    micToggleBtn.classList.remove('btn-danger')
    micToggleBtn.classList.add('btn-secondary')
  } else {
    micToggleBtn.textContent = 'Unmute Mic'
    micToggleBtn.classList.remove('btn-secondary')
    micToggleBtn.classList.add('btn-danger')
  }
}

function cleanup() {
  if (dataChannel) {
    dataChannel.close()
    dataChannel = null
  }
  if (localMediaStream) {
    localMediaStream.getTracks().forEach((track) => track.stop())
    localMediaStream = null
  }
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  if (audioElement) {
    audioElement.pause()
    audioElement.srcObject = null
    audioElement = null
  }

  updateStatus('Disconnected')
  connectBtn.disabled = false
  disconnectBtn.disabled = true
  micToggleBtn.disabled = true
  micToggleBtn.textContent = 'Mute Mic'
}

connectBtn.addEventListener('click', startSession)
disconnectBtn.addEventListener('click', cleanup)
micToggleBtn.addEventListener('click', toggleMic)
