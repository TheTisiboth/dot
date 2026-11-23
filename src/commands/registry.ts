import type { Api, Bot } from 'grammy'
import type { Message } from 'grammy/types'
import { EMOJIS } from '../shared/emojis'
import { errorMessage, log } from '../shared/logger'
import { type ChatTarget, type Sender, senderFor } from '../telegram/sender'

export interface CommandContext {
  /** The text after the command, trimmed; empty when there is none. */
  args: string;
  /** Where the command was typed. */
  chat: ChatTarget;
  /** Answers in the chat and topic the command came from. */
  reply: Sender;
}

/** One declaration per command: routing, admin guard, logging, error reply and menus all come from it. */
export interface Command {
  name: string;
  description: string;
  /** Exists in the admin chat only: elsewhere it is ignored silently. */
  adminOnly?: boolean;
  run: (ctx: CommandContext) => Promise<unknown>;
}

const COMMAND = /^\/(\w+)(?:@(\w+))?(?:\s+(.*))?$/s

/** The command a whole message invokes, or undefined for plain text and commands addressed to another bot. */
export const parseCommand = (text: string, botUsername: string): { name: string; args: string } | undefined => {
  const [, name, target, args = ''] = COMMAND.exec(text) ?? []
  if (!name || (target && target.toLowerCase() !== botUsername.toLowerCase())) return undefined
  return { name: name.toLowerCase(), args: args.trim() }
}

/** Sends each command to its handler; any other message goes on to the next middleware. */
export const routeCommands = (bot: Bot, commands: readonly Command[], adminChatId: string): void => {
  bot.on('message:text', async (ctx, next) => {
    const parsed = parseCommand(ctx.msg.text, ctx.me.username)
    const command = parsed && commands.find(({ name }) => name === parsed.name)
    if (!parsed || !command) return next()

    await runCommand(bot.api, command, ctx.msg, parsed.args, adminChatId)
  })
}

const runCommand = async (api: Api, { name, adminOnly, run }: Command, msg: Message, args: string, adminChatId: string): Promise<void> => {
  const user = msg.from?.username || msg.from?.id
  if (adminOnly && String(msg.chat.id) !== adminChatId) {
    log.auth(`Non-admin attempted /${name}`, user, msg.chat.id)
    return
  }

  log.command(`/${name}`, msg.chat.id, user, msg.message_thread_id)
  const chat = originOf(msg)
  const reply = senderFor(api, chat)

  try {
    await run({ args, chat, reply })
  } catch (error) {
    log.error(`/${name}`, error)
    await reply.plain(`${EMOJIS.CROSS_MARK} Error: ${errorMessage(error)}`)
  }
}

/** Outside forum topics message_thread_id points at a reply thread, not a topic: answer in the chat then. */
const originOf = (msg: Message): ChatTarget => ({
  chatId: String(msg.chat.id),
  threadId: msg.is_topic_message ? msg.message_thread_id : undefined
})

/** Telegram's command menus: public commands everywhere, all of them in the admin chat. */
export const publishCommandMenus = async (api: Api, commands: readonly Command[], adminChatId: string): Promise<void> => {
  const menu = (list: readonly Command[]) => list.map(({ name, description }) => ({ command: name, description }))

  await api.setMyCommands(menu(commands.filter(({ adminOnly }) => !adminOnly)))
  await api.setMyCommands(menu(commands), { scope: { type: 'chat', chat_id: Number(adminChatId) } })
}
