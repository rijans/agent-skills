import { TelegramClient } from '@mtcute/node'
import { Dispatcher, filters } from '@mtcute/dispatcher'
import dotenv from 'dotenv'

dotenv.config()

const apiId = Number.parseInt(process.env.API_ID || '0', 10)
const apiHash = process.env.API_HASH || ''

if (!apiId || !apiHash) {
  console.error('Error: API_ID and API_HASH environment variables are required.')
  console.error('Obtain your Telegram API credentials at https://my.telegram.org')
  process.exit(1)
}

// Initialize TelegramClient with local SQLite storage
const tg = new TelegramClient({
  apiId,
  apiHash,
  storage: 'data/userbot.session',
  floodSleepThreshold: 60,
})

// Initialize update dispatcher
const dp = Dispatcher.for(tg)

// Command: /ping or .ping
dp.onNewMessage(filters.command('ping', { prefixes: ['/', '.'] }), async (msg) => {
  const start = Date.now()
  const reply = await msg.replyText('Pong! 🏓')
  const latency = Date.now() - start
  await reply.edit(`Pong! 🏓 (\`${latency}ms\`)`, { parseMode: 'markdown' })
})

// Command: /echo <text>
dp.onNewMessage(filters.command('echo', { prefixes: ['/', '.'] }), async (msg) => {
  const args = msg.command.slice(1).join(' ')
  if (!args) {
    return await msg.replyText('Usage: `.echo <message>`')
  }
  await msg.replyText(args)
})

// Graceful shutdown
async function handleShutdown() {
  console.log('\nShutting down userbot safely...')
  try {
    await tg.close()
    console.log('Session saved and connection closed.')
    process.exit(0)
  } catch (err) {
    console.error('Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGINT', handleShutdown)
process.on('SIGTERM', handleShutdown)

async function start() {
  console.log('Starting mtcute client...')

  const authOptions = {}
  if (process.env.SESSION_STRING) {
    authOptions.session = process.env.SESSION_STRING
  } else if (process.env.BOT_TOKEN) {
    authOptions.botToken = process.env.BOT_TOKEN
  }

  const self = await tg.start(authOptions)
  console.log(`✨ Connected as: ${self.displayName} (@${self.username || 'n/a'})`)
  console.log('Listening for messages...')
}

start().catch((err) => {
  console.error('Fatal initialization error:', err)
  process.exit(1)
})
