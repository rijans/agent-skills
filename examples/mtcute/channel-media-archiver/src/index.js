import { TelegramClient, tl } from '@mtcute/node'
import { Dispatcher, filters } from '@mtcute/dispatcher'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

dotenv.config()

const apiId = Number.parseInt(process.env.API_ID || '0', 10)
const apiHash = process.env.API_HASH || ''
const targetChannel = process.env.TARGET_CHANNEL || ''
const downloadDir = path.resolve(process.env.DOWNLOAD_DIR || './downloads')

if (!apiId || !apiHash) {
  console.error('Error: API_ID and API_HASH environment variables are required.')
  process.exit(1)
}

// Ensure download directory exists
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true })
}

const tg = new TelegramClient({
  apiId,
  apiHash,
  storage: 'data/archiver.session',
  floodSleepThreshold: 120,
})

const dp = Dispatcher.for(tg)

// Filter for documents or videos
const mediaFilter = filters.or(filters.video, filters.document, filters.photo)

dp.onNewMessage(mediaFilter, async (msg) => {
  // Check if message belongs to target channel
  if (targetChannel && msg.chat.username !== targetChannel.replace(/^@/, '')) {
    return
  }

  const media = msg.media
  if (!media) return

  // Determine safe sanitized filename
  const originalName =
    media.fileName || `${media.type}_${msg.id}_${Date.now()}.${media.type === 'photo' ? 'jpg' : 'bin'}`
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const destinationPath = path.join(downloadDir, sanitizedName)

  console.log(`\n📥 Detected new media in message #${msg.id}: ${sanitizedName}`)

  try {
    // Stream directly to disk without memory buffering
    await tg.downloadToFile(destinationPath, media, {
      progressCallback: (downloaded, total) => {
        if (!total) return
        const percent = ((downloaded / total) * 100).toFixed(1)
        const mbDownloaded = (downloaded / (1024 * 1024)).toFixed(1)
        const mbTotal = (total / (1024 * 1024)).toFixed(1)
        process.stdout.write(`\rDownloading: ${percent}% (${mbDownloaded}MB / ${mbTotal}MB)`)
      },
    })

    console.log(`\n✅ Saved to: ${destinationPath}`)
  } catch (err) {
    if (tl.RpcError.is(err, 'FLOOD_WAIT_%d')) {
      console.warn(`\n⚠️ Rate-limited by Telegram. Flood wait: ${err.seconds}s`)
    } else {
      console.error(`\n❌ Failed to download message #${msg.id}:`, err)
    }
  }
})

async function start() {
  console.log('Connecting to Telegram MTProto gateway...')
  const self = await tg.start()
  console.log(`✨ Archiver running as @${self.username || self.displayName}`)
  console.log(`Monitoring channel: ${targetChannel || 'All subscribed channels'}`)
  console.log(`Saving media to: ${downloadDir}`)
}

async function handleShutdown() {
  console.log('\nStopping archiver gracefully...')
  try {
    await tg.close()
    console.log('Client disconnected.')
    process.exit(0)
  } catch (err) {
    console.error('Shutdown error:', err)
    process.exit(1)
  }
}

process.on('SIGINT', handleShutdown)
process.on('SIGTERM', handleShutdown)

start().catch((err) => {
  console.error('Fatal initialization error:', err)
  process.exit(1)
})
