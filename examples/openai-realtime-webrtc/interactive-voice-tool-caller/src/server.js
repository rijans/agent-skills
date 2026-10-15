import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, 'public')
const PORT = Number(process.env.PORT || 3001)

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
}

// Mock Flight Database for the backend-delegated tool
const FLIGHT_DATABASE = {
  'AA-100': { flight: 'AA-100', origin: 'JFK', destination: 'LHR', status: 'On Time', gate: 'B22' },
  'UA-452': { flight: 'UA-452', origin: 'SFO', destination: 'ORD', status: 'Delayed (35m)', gate: 'E14' },
  'DL-882': { flight: 'DL-882', origin: 'ATL', destination: 'CDG', status: 'Boarding', gate: 'T4' },
}

const server = http.createServer(async (req, res) => {
  // 1. Session Token Minting with Declared Tools
  if (req.method === 'POST' && req.url === '/api/session') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(
        JSON.stringify({
          error: 'OPENAI_API_KEY environment variable is not configured.',
        })
      )
    }

    try {
      console.log('[Server] Minting session with tool schemas...')
      const openAiRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview',
          voice: 'ash',
          instructions:
            'You are a smart voice assistant capable of controlling the application theme and checking real-time flight statuses. When the user asks to change the theme or check a flight, call the appropriate tool. Always speak a helpful, concise answer after using a tool.',
          input_audio_transcription: {
            model: 'whisper-1',
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
          },
          tools: [
            {
              type: 'function',
              name: 'change_theme',
              description: 'Switch the application UI theme color mode.',
              parameters: {
                type: 'object',
                properties: {
                  theme: {
                    type: 'string',
                    enum: ['light', 'dark', 'cyberpunk', 'emerald'],
                    description: 'The target theme name.',
                  },
                },
                required: ['theme'],
              },
            },
            {
              type: 'function',
              name: 'check_flight_status',
              description: 'Retrieve real-time flight status and departure gate information.',
              parameters: {
                type: 'object',
                properties: {
                  flight_number: {
                    type: 'string',
                    description: 'The airline code and flight number (e.g. AA-100, UA-452, DL-882).',
                  },
                },
                required: ['flight_number'],
              },
            },
          ],
        }),
      })

      if (!openAiRes.ok) {
        const errorText = await openAiRes.text()
        res.writeHead(openAiRes.status, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: errorText }))
      }

      const data = await openAiRes.json()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(data))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: err.message }))
    }
  }

  // 2. Backend Tool Delegation API
  if (req.method === 'GET' && req.url.startsWith('/api/flights/')) {
    const flightNumber = decodeURIComponent(req.url.replace('/api/flights/', '')).toUpperCase()
    console.log(`[Server Tool] Looking up flight: ${flightNumber}`)

    const info = FLIGHT_DATABASE[flightNumber]
    if (info) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(info))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: `Flight ${flightNumber} not found in database.` }))
    }
  }

  // 3. Static File Server
  const reqPath = req.url === '/' ? '/index.html' : req.url
  const filePath = path.join(publicDir, path.normalize(reqPath))

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    return res.end('Access Denied')
  }

  try {
    const ext = path.extname(filePath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const content = await fs.promises.readFile(filePath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
})

server.listen(PORT, () => {
  console.log(`[Server] Interactive Tool Caller listening at http://localhost:${PORT}`)
})
