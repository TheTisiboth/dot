import type { Api, Bot } from 'grammy'
import type { InlineKeyboardMarkup, MaybeInaccessibleMessage, User } from 'grammy/types'
import { EMOJIS } from '../shared/emojis'
import { log } from '../shared/logger'
import { type ChatTarget, type Sender, senderFor } from '../telegram/sender'

export interface CommandContext {
  /** The text after the command, trimmed; empty when there is none. */
  args: string;
  /** Where the command was typed. */
  chat: ChatTarget;
  /** Answers in the chat and topic the command came from. */
  reply: Sender;
}

export interface ButtonContext extends Omit<CommandContext, 'args'> {
  /** The button's callback data after `<command name>:`. */
  data: string;
  /** Replaces the buttons of the tapped message. */
  setButtons: (buttons: InlineKeyboardMarkup) => Promise<unknown>;
}

/** One declaration per command: routing, admin guard, logging, error reply and menus all come from it. */
export interface Command {
  name: string;
  description: string;
  /** Exists in the admin chat only: elsewhere it is ignored silently. */
  adminOnly?: boolean;
  run: (ctx: CommandContext) => Promise<unknown>;
  /** Taps on buttons whose callback data starts with `<name>:`, guarded like the command itself. */
  onButton?: (ctx: ButtonContext) => Promise<unknown>;
}

const COMMAND = /^\/(\w+)(?:@(\w+))?(?:\s+(.*))?$/s

/** The command a whole message invokes, or undefined for plain text and commands addressed to another bot. */
export const parseCommand = (text: string, botUsername: string): { name: string; args: string } | undefined => {
  const [, name, target, args = ''] = COMMAND.exec(text) ?? []
  if (!name || (target && target.toLowerCase() !== botUsername.toLowerCase())) return undefined
  return { name: name.toLowerCase(), args: args.trim() }
}

/** Sends each command to its handler, and each button tap to its command; any other message goes on to the next middleware. */
export const routeCommands = (bot: Bot, commands: readonly Command[], adminChatId: string): void => {
  bot.on('message:text', async (ctx, next) => {
    const parsed = parseCommand(ctx.msg.text, ctx.me.username)
    const command = parsed && commands.find(({ name }) => name === parsed.name)
    if (!parsed || !command) return next()

    await guarded(bot.api, command, ctx.msg, ctx.msg.from, adminChatId, `/${command.name}`, (chat, reply) =>
      command.run({ args: parsed.args, chat, reply }))
  })

  bot.on('callback_query:data', async (ctx) => {
    const { id, data, message, from } = ctx.callbackQuery
    // Acknowledged first, whatever follows: else the button keeps spinning, through a minutes-long LLM call too
    await bot.api.answerCallbackQuery(id).catch((error: unknown) => { log.error('Acknowledging a button tap', error) })

    const [name = '', ...rest] = data.split(':')
    const buttonData = rest.join(':')
    const command = commands.find(command => command.name === name)
    const onButton = command?.onButton
    if (!command || !onButton || !message) return

    const setButtons = (buttons: InlineKeyboardMarkup) => bot.api.editMessageReplyMarkup(message.chat.id, message.message_id, { reply_markup: buttons })
    await guarded(bot.api, command, message, from, adminChatId, `/${name} button ${buttonData}`, (chat, reply) =>
      onButton({ data: buttonData, chat, reply, setButtons }))
  })
}

/** The admin guard, logging and error reply every command and button tap goes through. */
const guarded = async (
  api: Api, { name, adminOnly }: Command, msg: MaybeInaccessibleMessage, from: User | undefined, adminChatId: string,
  label: string, handle: (chat: ChatTarget, reply: Sender) => Promise<unknown>
): Promise<void> => {
  const user = from?.username || from?.id
  if (adminOnly && String(msg.chat.id) !== adminChatId) {
    log.auth(`Non-admin attempted ${label}`, user, msg.chat.id)
    return
  }

  log.command(label, msg.chat.id, user, msg.message_thread_id)
  const chat = originOf(msg)
  const reply = senderFor(api, chat)

  try {
    await handle(chat, reply)
  } catch (error) {
    log.error(label, error)
    // The cause stays in the log: exception text means nothing to a player and can leak internals
    await reply.plain(`${EMOJIS.CROSS_MARK} Sorry, /${name} failed. ${adminOnly ? 'The log has the details.' : 'Please try again later.'}`)
  }
}

/** Outside forum topics message_thread_id points at a reply thread, not a topic: answer in the chat then. */
const originOf = (msg: MaybeInaccessibleMessage): ChatTarget => ({
  chatId: String(msg.chat.id),
  threadId: msg.is_topic_message ? msg.message_thread_id : undefined
})

/** Telegram's command menus: public commands everywhere, all of them in the admin chat. */
export const publishCommandMenus = async (api: Api, commands: readonly Command[], adminChatId: string): Promise<void> => {
  const menu = (list: readonly Command[]) => list.map(({ name, description }) => ({ command: name, description }))

  await api.setMyCommands(menu(commands.filter(({ adminOnly }) => !adminOnly)))
  await api.setMyCommands(menu(commands), { scope: { type: 'chat', chat_id: Number(adminChatId) } })
}
