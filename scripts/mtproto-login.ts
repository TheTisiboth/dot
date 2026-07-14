import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * One-off: mints the TELEGRAM_SESSION string for the user account that reads reactions.
 * Run on your machine (needs a terminal), never in Docker: `npm run mtproto:login`
 */
async function main(): Promise<void> {
  const apiId = Number(process.env.TELEGRAM_API_ID)
  const apiHash = process.env.TELEGRAM_API_HASH

  if (!apiId || !apiHash) {
    console.error('❌ Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first.')
    console.error('   Get them from https://my.telegram.org → API development tools')
    process.exit(1)
  }

  const rl = createInterface({ input: stdin, output: stdout })
  const ask = async (question: string): Promise<string> => (await rl.question(question)).trim()

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 })

  try {
    await client.start({
      phoneNumber: async () => await ask('Phone number (international format, e.g. +33...): '),
      phoneCode: async () => await ask('Login code (Telegram sends it inside the app, not by SMS): '),
      password: async () => await ask('2FA password (press Enter if you have none): '),
      onError: (err) => console.error(err)
    })

    console.log('\n✅ Logged in. Add this line to your .env:\n')
    console.log(`TELEGRAM_SESSION=${client.session.save() as unknown as string}\n`)
    console.log('⚠️  This string grants FULL access to your Telegram account. Never commit or share it.')
    console.log('   To revoke: Telegram → Settings → Devices → terminate the session.\n')
  } finally {
    rl.close()
    await client.disconnect()
  }

  process.exit(0)
}

void main()
