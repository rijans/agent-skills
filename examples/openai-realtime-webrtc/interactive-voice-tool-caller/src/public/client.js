let peerConnection = null
let dataChannel = null
let localMediaStream = null
let audioElement = null
let audioCtx = null
let analyser = null
let animationFrameId = null
let currentAssistantMsgEl = null

const connectBtn = document.getElementById('connectBtn')
const disconnectBtn = document.getElementById('disconnectBtn')
const statusPill = document.getElementById('statusPill')
const transcriptFeed = document.getElementById('transcriptFeed')
const canvas = document.getElementById('waveformCanvas')
const currentThemeLabel = document.getElementById('currentThemeLabel')
const flightCard = document.getElementById('flightCard')

function updateStatus(text, state) {
  statusPill.textContent = text
  if (state) {
    statusPill.setAttribute('data-state', state)
  } else {
    statusPill.removeAttribute('data-state')
  }
}

function appendMessage(role, text) {
  const placeholder = transcriptFeed.querySelector('.placeholder-text')
  if (placeholder) placeholder.remove()

  const msgDiv = document.createElement('div')
  msgDiv.className = `msg msg-${role}`
  msgDiv.textContent = text
  transcriptFeed.appendChild(msgDiv)
  transcriptFeed.scrollTop = transcriptFeed.scrollHeight
  return msgDiv
}

function startVisualizer(stream) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const source = audioCtx.createMediaStreamSource(stream)
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 64
  source.connect(analyser)

  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  const canvasCtx = canvas.getContext('2d')

  function draw() {
    animationFrameId = requestAnimationFrame(draw)
    analyser.getByteFrequencyData(dataArray)

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height)
    const barWidth = (canvas.width / bufferLength) * 1.5
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height
      canvasCtx.fillStyle = '#3b82f6'
      canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight)
      x += barWidth
    }
  }

  draw()
}

async function startAgent() {
  updateStatus('Connecting...', 'thinking')
  connectBtn.disabled = true

  try {
    // 1. Fetch Ephemeral Session Token with pre-declared tools
    const sessionRes = await fetch('/api/session', { method: 'POST' })
    if (!sessionRes.ok) {
      const err = await sessionRes.json()
      throw new Error(err.error || 'Server error minting session token')
    }
    const sessionData = await sessionRes.json()
    const ephemeralKey = sessionData.client_secret?.value
    if (!ephemeralKey) {
      throw new Error('Missing ephemeral client_secret.value in response')
    }

    // 2. Setup WebRTC Peer Connection
    peerConnection = new RTCPeerConnection()

    audioElement = document.createElement('audio')
    audioElement.autoplay = true
    peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Received model audio stream')
      audioElement.srcObject = event.streams[0]
      // Visualize incoming model audio
      startVisualizer(event.streams[0])
    }

    // 3. Capture Microphone with Echo Cancellation
    localMediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    localMediaStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localMediaStream)
    })

    // 4. Create Data Channel for Tool Calling & Events
    dataChannel = peerConnection.createDataChannel('oai-events')

    dataChannel.onopen = () => {
      console.log('[WebRTC] oai-events channel ready')
      updateStatus('Agent Active', 'connected')
      disconnectBtn.disabled = false
    }

    dataChannel.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data)
        await handleRealtimeEvent(msg)
      } catch (err) {
        console.error('[WebRTC] Error handling message:', err)
      }
    }

    // 5. Generate SDP Offer
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    // 6. Direct SDP Exchange with OpenAI Realtime API
    const baseUrl = 'https://api.openai.com/v1/realtime'
    const model = 'gpt-4o-realtime-preview'
    const sdpRes = await fetch(`${baseUrl}?model=${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    })

    if (!sdpRes.ok) {
      const errText = await sdpRes.text()
      throw new Error(`OpenAI SDP error: ${errText}`)
    }

    const sdpAnswer = await sdpRes.text()
    await peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: sdpAnswer,
    })

    console.log('[WebRTC] Interactive session active!')
  } catch (err) {
    console.error('[WebRTC] Start failed:', err)
    alert(`Connection error: ${err.message}`)
    cleanup()
  }
}

async function handleRealtimeEvent(msg) {
  switch (msg.type) {
    // 1. Tool Call Execution Trigger
    case 'response.function_call_arguments.done': {
      const { call_id, name, arguments: rawArgs } = msg
      console.log(`[Tool Call] Executing ${name} (call_id: ${call_id})`)
      updateStatus(`Running ${name}...`, 'thinking')

      let parsedArgs = {}
      try {
        parsedArgs = JSON.parse(rawArgs)
      } catch (e) {
        console.error('Failed to parse tool arguments:', e)
      }

      let toolResult = {}

      // A. Client Tool: change_theme
      if (name === 'change_theme') {
        const targetTheme = parsedArgs.theme || 'dark'
        document.body.setAttribute('data-theme', targetTheme)
        currentThemeLabel.textContent = targetTheme
        toolResult = { success: true, theme: targetTheme }
        appendMessage('assistant', `[Tool Executed]: Switched theme to ${targetTheme}`)
      }

      // B. Backend Delegated Tool: check_flight_status
      else if (name === 'check_flight_status') {
        const flightNum = (parsedArgs.flight_number || '').trim()
        appendMessage('assistant', `[Tool Executed]: Checking flight ${flightNum}...`)
        try {
          const res = await fetch(`/api/flights/${encodeURIComponent(flightNum)}`)
          toolResult = await res.json()
          renderFlightCard(toolResult)
        } catch (fetchErr) {
          toolResult = { error: 'Failed to connect to flight database service' }
        }
      } else {
        toolResult = { error: `Unrecognized tool: ${name}` }
      }

      // 2. Submit Tool Output and Trigger Model Speech Response
      submitToolOutput(call_id, toolResult)
      break
    }

    // Barge-In Interruption
    case 'input_audio_buffer.speech_started':
      console.log('[Barge-In] User interrupted')
      updateStatus('User Speaking...', 'connected')
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
      currentAssistantMsgEl = null
      break

    // Live User Speech Transcript
    case 'conversation.item.input_audio_transcription.completed':
      if (msg.transcript && msg.transcript.trim()) {
        appendMessage('user', msg.transcript.trim())
      }
      break

    // Live Model Voice Streaming Transcript
    case 'response.audio_transcript.delta':
      updateStatus('Agent Speaking...', 'speaking')
      if (!currentAssistantMsgEl) {
        currentAssistantMsgEl = appendMessage('assistant', '')
      }
      currentAssistantMsgEl.textContent += msg.delta
      transcriptFeed.scrollTop = transcriptFeed.scrollHeight
      break

    case 'response.done':
      updateStatus('Agent Ready', 'connected')
      currentAssistantMsgEl = null
      break
  }
}

function submitToolOutput(callId, resultObject) {
  // 1. Send tool result back into conversation
  dataChannel.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(resultObject),
      },
    })
  )

  // 2. Instruct model to speak the result
  dataChannel.send(
    JSON.stringify({
      type: 'response.create',
    })
  )
}

function renderFlightCard(flight) {
  if (flight.error) {
    flightCard.innerHTML = `<div class="flight-status-text" style="color: #ef4444;">${flight.error}</div>`
    return
  }

  flightCard.innerHTML = `
    <div class="flight-row"><span>Flight:</span><strong>${flight.flight}</strong></div>
    <div class="flight-row"><span>Route:</span><strong>${flight.origin} ➔ ${flight.destination}</strong></div>
    <div class="flight-row"><span>Status:</span><strong>${flight.status}</strong></div>
    <div class="flight-row"><span>Gate:</span><strong>${flight.gate}</strong></div>
  `
}

function cleanup() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (audioCtx) {
    audioCtx.close()
    audioCtx = null
  }
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
}

connectBtn.addEventListener('click', startAgent)
disconnectBtn.addEventListener('click', cleanup)
