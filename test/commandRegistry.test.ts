import './helpers/testEnv'
import { test, mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { type Command, type CommandContext, parseCommand, publishCommandMenus, routeCommands } from '../src/commands/registry'
import { BOT_USERNAME, makeFakeBot } from './fakes/bot'

const ADMIN = { chatId: 100 }
const PLAYER = { chatId: 555 }

/** A command recording each context it runs with. */
const recording = (name: string, { adminOnly = false } = {}) => {
  const runs: CommandContext[] = []
  const command: Command = { name, description: `does ${name}`, adminOnly, run: async (ctx) => { runs.push(ctx) } }
  return { runs, command }
}

const route = (...commands: Command[]) => {
  const bot = makeFakeBot()
  routeCommands(bot, commands, String(ADMIN.chatId))
  return bot
}

afterEach(() => { mock.restoreAll() })

test('a command is parsed whatever its case, with or without this bot as target', () => {
  for (const text of ['/help', '/HELP', `/help@${BOT_USERNAME}`, `/help@${BOT_USERNAME.toUpperCase()}`]) {
    assert.deepEqual(parseCommand(text, BOT_USERNAME), { name: 'help', args: '' }, text)
  }
})

test('the args are the trimmed text after the command', () => {
  assert.equal(parseCommand('/test_rule  sig_01 ', BOT_USERNAME)?.args, 'sig_01')
  assert.equal(parseCommand(`/test_rule@${BOT_USERNAME} sig_01`, BOT_USERNAME)?.args, 'sig_01')
})

test('plain text and commands addressed to another bot are no command', () => {
  for (const text of ['hello', 'see /help', '/help@OtherBot', '/', ' /help']) {
    assert.equal(parseCommand(text, BOT_USERNAME), undefined, text)
  }
})

test('only a whole-message command runs its handler', async () => {
  const help = recording('help')
  const bot = route(help.command)

  for (const text of ['/information', 'see /help', '/help@OtherBot']) await bot.command(text, PLAYER)
  assert.equal(help.runs.length, 0)

  for (const text of ['/help', `/help@${BOT_USERNAME}`, '/HELP']) await bot.command(text, PLAYER)
  assert.equal(help.runs.length, 3)
})

test('messages that are no known command go on to the next middleware', async () => {
  const bot = route(recording('help').command)
  const passedOn: string[] = []
  bot.on('message:text', async ({ msg }) => { passedOn.push(msg.text) })

  for (const text of ['hello', '/unknown', '/help']) await bot.command(text, PLAYER)

  assert.deepEqual(passedOn, ['hello', '/unknown'])
})

test('an admin-only command runs in the admin chat and is ignored silently elsewhere', async () => {
  const attendance = recording('attendance', { adminOnly: true })
  const bot = route(attendance.command)

  await bot.command('/attendance', PLAYER)
  assert.equal(attendance.runs.length, 0)
  assert.deepEqual(bot.sent, [])

  await bot.command('/attendance', ADMIN)
  assert.equal(attendance.runs.length, 1)
})

test('a handler gets its args and replies in the chat and topic the command came from', async () => {
  const bot = route({ name: 'echo', description: 'echo', run: ({ args, reply }) => reply.plain(args) })

  await bot.command('/echo hi', { ...PLAYER, topicId: 9 })

  const [reply] = bot.sentTo(PLAYER.chatId)
  assert.equal(reply.text, 'hi')
  assert.equal(reply.options.message_thread_id, 9)
})

test('a throwing handler gets one error reply and one error log', async () => {
  const bot = route({ name: 'broken', description: 'broken', run: async () => { throw new Error('season broken') } })
  const errors = mock.method(console, 'error', () => {})

  await bot.command('/broken', PLAYER)

  const replies = bot.sentTo(PLAYER.chatId)
  assert.equal(replies.length, 1)
  assert.ok(replies[0].text.includes('season broken'))
  assert.equal(errors.mock.calls.filter(({ arguments: [line] }) => String(line).includes('season broken')).length, 1)
})

test('the public menu lists public commands; the admin chat menu lists them all', async () => {
  const bot = makeFakeBot()
  const commands = [recording('help').command, recording('attendance', { adminOnly: true }).command]

  await publishCommandMenus(bot.api, commands, String(ADMIN.chatId))

  const [everyone, admin] = bot.menus
  assert.deepEqual(everyone.commands.map(({ command }) => command), ['help'])
  assert.deepEqual(admin.commands.map(({ command }) => command), ['help', 'attendance'])
  assert.deepEqual(admin.options?.scope, { type: 'chat', chat_id: ADMIN.chatId })
})
