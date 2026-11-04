import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import QRCode from 'qrcode'
import dotenv from 'dotenv'

dotenv.config()

const RESEND = 'r'

/** Where Telegram says it sent the code: client.start() hides this, so a code that never shows up is a mystery. */
function describeDelivery(type: Api.auth.TypeSentCodeType): string {
  if (type instanceof Api.auth.SentCodeTypeApp) return 'in the Telegram app, in the "Telegram" chat of a device already logged in'
  if (type instanceof Api.auth.SentCodeTypeSms || type instanceof Api.auth.SentCodeTypeSmsWord || type instanceof Api.auth.SentCodeTypeSmsPhrase) return 'by SMS'
  if (type instanceof Api.auth.SentCodeTypeFirebaseSms) return 'by SMS (Firebase)'
  if (type instanceof Api.auth.SentCodeTypeCall) return 'by phone call'
  if (type instanceof Api.auth.SentCodeTypeFlashCall || type instanceof Api.auth.SentCodeTypeMissedCall) return 'as a missed call: the code is the last digits of the calling number'
  if (type instanceof Api.auth.SentCodeTypeEmailCode) return `by email, to ${type.emailPattern}`
  if (type instanceof Api.auth.SentCodeTypeFragmentSms) return `on Fragment (anonymous number): ${type.url}`
  if (type instanceof Api.auth.SentCodeTypeSetUpEmailRequired) return 'nowhere yet: Telegram wants a login email set up first, in an official app (Settings → Privacy and Security → Login Email)'
  return 'in a way this script does not know'
}

function describeSent(sent: Api.auth.SentCode): string {
  const lines = [`📨 Code sent ${describeDelivery(sent.type)}.`]
  if (sent.nextType) lines.push(`   Type "${RESEND}" to resend it another way (${sent.nextType.className.replace('auth.CodeType', '')})${sent.timeout ? ` after ${sent.timeout}s` : ''}.`)
  return lines.join('\n')
}

/**
 * One-off: mints the TELEGRAM_SESSION string for the user account that reads reactions.
 * Run on your machine (needs a terminal), never in Docker: `npm run mtproto:login`
 * Each run creates a new session: give every running bot its own, or Telegram revokes it (AUTH_KEY_DUPLICATED).
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

  // WebSocket on 443: networks that filter MTProto's raw TCP still let HTTPS through
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5, useWSS: true })

  try {
    await client.connect()
    const phoneNumber = await ask('Phone number (international format, e.g. +33...), or press Enter to log in with a QR code: ')

    if (phoneNumber) {
      const code = await requestCode(client, phoneNumber, { apiId, apiHash }, ask)
      await signIn(client, { phoneNumber, ...code }, { apiId, apiHash }, ask)
    } else {
      await signInWithQrCode(client, { apiId, apiHash }, ask)
    }

    console.log('\n✅ Logged in. Add this line to your .env:\n')
    console.log(`TELEGRAM_SESSION=${client.session.save() as unknown as string}\n`)
    console.log('⚠️  This string grants FULL access to your Telegram account. Never commit or share it.')
    console.log('   Use it in ONE place only: a session shared by two running bots gets revoked (AUTH_KEY_DUPLICATED).')
    console.log('   To revoke: Telegram → Settings → Devices → terminate the session.\n')
  } finally {
    rl.close()
    await client.disconnect()
  }

  process.exit(0)
}

/** Sends the code, says where it went, and resends it another way on request until one is typed. */
async function requestCode(
  client: TelegramClient,
  phoneNumber: string,
  credentials: { apiId: number; apiHash: string },
  ask: (question: string) => Promise<string>
): Promise<{ phoneCodeHash: string; phoneCode: string }> {
  let sent = asSentCode(await client.invoke(new Api.auth.SendCode({ phoneNumber, ...credentials, settings: new Api.CodeSettings({}) })))
  console.log(describeSent(sent))

  let phoneCode = await ask('Login code: ')
  while (phoneCode === RESEND) {
    sent = asSentCode(await client.invoke(new Api.auth.ResendCode({ phoneNumber, phoneCodeHash: sent.phoneCodeHash })))
    console.log(describeSent(sent))
    phoneCode = await ask('Login code: ')
  }

  return { phoneCodeHash: sent.phoneCodeHash, phoneCode }
}

function asSentCode(reply: Api.auth.TypeSentCode): Api.auth.SentCode {
  if (!(reply instanceof Api.auth.SentCode)) throw new Error(`Unexpected reply to the code request: ${reply.className}`)
  return reply
}

/** No code to receive: a phone already logged in scans the QR (Settings → Devices → Link Desktop Device). */
async function signInWithQrCode(
  client: TelegramClient,
  credentials: { apiId: number; apiHash: string },
  ask: (question: string) => Promise<string>
): Promise<void> {
  await client.signInUserWithQrCode(credentials, {
    // Called again with a fresh token each time the previous one expires (about every 30s)
    qrCode: async ({ token }) => {
      const qr = await QRCode.toString(`tg://login?token=${token.toString('base64url')}`, { type: 'terminal', small: true })
      console.log(`\n${qr}\nScan it in the Telegram app: Settings → Devices → Link Desktop Device. It refreshes on its own.`)
    },
    password: async (hint) => await ask(`2FA password${hint ? ` (hint: ${hint})` : ''}: `),
    onError: (err) => { console.error(err) }
  })
}

async function signIn(
  client: TelegramClient,
  code: { phoneNumber: string; phoneCodeHash: string; phoneCode: string },
  credentials: { apiId: number; apiHash: string },
  ask: (question: string) => Promise<string>
): Promise<void> {
  try {
    await client.invoke(new Api.auth.SignIn(code))
  } catch (error) {
    if (!(error instanceof Error && error.message.includes('SESSION_PASSWORD_NEEDED'))) throw error
    await client.signInWithPassword(credentials, {
      password: async (hint) => await ask(`2FA password${hint ? ` (hint: ${hint})` : ''}: `),
      onError: (err) => { console.error(err) }
    })
  }
}

void main()
