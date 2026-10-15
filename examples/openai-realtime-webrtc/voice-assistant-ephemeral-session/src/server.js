import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, 'public')
const PORT = Number(process.env.PORT || 3000)

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
}

const server = http.createServer(async (req, res) => {
  // 1. Session Token Minting Endpoint
  if (req.method === 'POST' && req.url === '/api/session') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(
        JSON.stringify({
          error: 'OPENAI_API_KEY environment variable is not set on the server.',
        })
      )
    }

    try {
      console.log('[Server] Requesting ephemeral session token from OpenAI...')
      const openAiRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview',
          voice: 'coral',
          instructions:
            'You are a fast, intelligent, and natural conversational voice assistant. Keep answers brief and conversational.',
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

      if (!openAiRes.ok) {
        const errorText = await openAiRes.text()
        console.error('[Server] OpenAI session error:', errorText)
        res.writeHead(openAiRes.status, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ error: errorText }))
      }

      const data = await openAiRes.json()
      console.log('[Server] Ephemeral token minted successfully. Expires in 60s.')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(data))
    } catch (err) {
      console.error('[Server] Internal error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: err.message }))
    }
  }

  // 2. Static File Server
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
  console.log(`[Server] Voice Assistant listening at http://localhost:${PORT}`)
})
