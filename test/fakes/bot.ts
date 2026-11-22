import { type Bot, GrammyError } from 'grammy'
import type { BotCommand, BotCommandScope, Message } from 'grammy/types'

interface SentMessage {
  chatId: string;
  text: string;
  options: Record<string, unknown>;
  messageId: number;
}

interface CommandMenu {
  commands: readonly BotCommand[];
  options?: { scope?: BotCommandScope };
}

type Middleware = (ctx: { msg: Message & { text: string }; me: { username: string } }, next: () => Promise<void>) => Promise<unknown>
type TapHandler = (ctx: { callbackQuery: { id: string; data: string; message: Message; from: { id: number; is_bot: false; first_name: string } } }) => Promise<unknown>

export const BOT_USERNAME = 'dot_bot'

/** Where a command is typed: a chat, optionally a forum topic in it. */
interface CommandOrigin { chatId: number; topicId?: number }

/** The message whose button is tapped. */
interface TapOrigin extends CommandOrigin { messageId: number }

/** A Bot API stand-in recording what is sent where. Sends to `failingChat` throw, as a Telegram outage would; set it to undefined to recover. `rejectNextParse` makes the next send fail as unparsable HTML. */
export const makeFakeBot = ({ failingChat }: { failingChat?: string } = {}) => {
  let nextMessageId = 1
  const middlewares: Middleware[] = []
  const tapHandlers: TapHandler[] = []

  function on(filter: 'message:text', handler: Middleware): void
  function on(filter: 'callback_query:data', handler: TapHandler): void
  function on(filter: string, handler: Middleware | TapHandler): void {
    // The library boundary: grammY types each handler by its filter
    if (filter === 'message:text') middlewares.push(handler as Middleware)
    else tapHandlers.push(handler as TapHandler)
  }

  const fake = {
    failingChat,
    rejectNextParse: false,
    sent: [] as SentMessage[],
    menus: [] as CommandMenu[],
    acknowledged: [] as string[],
    buttonEdits: [] as Array<{ chatId: string; messageId: number; markup: unknown }>,

    sentTo: (chatId: string | number) => fake.sent.filter(message => message.chatId === String(chatId)),

    api: {
      sendMessage: async (chatId: string | number, text: string, options: Record<string, unknown> = {}) => {
        if (String(chatId) === fake.failingChat) throw new Error('Telegram is down')
        if (fake.rejectNextParse) {
          fake.rejectNextParse = false
          const description = "Bad Request: can't parse entities: can't find end of the entity"
          throw new GrammyError(description, { ok: false, error_code: 400, description }, 'sendMessage', {})
        }
        const messageId = nextMessageId++
        fake.sent.push({ chatId: String(chatId), text, options, messageId })
        return { message_id: messageId }
      },
      setMyCommands: async (commands: readonly BotCommand[], options?: CommandMenu['options']) => {
        fake.menus.push({ commands, options })
        return true
      },
      answerCallbackQuery: async (id: string) => {
        fake.acknowledged.push(id)
        return true
      },
      editMessageReplyMarkup: async (chatId: string | number, messageId: number, { reply_markup }: { reply_markup: unknown }) => {
        fake.buttonEdits.push({ chatId: String(chatId), messageId, markup: reply_markup })
        return true
      }
    },

    on,

    /** Taps a button carrying `data` on a message the bot sent. */
    tap: async (data: string, { chatId, topicId, messageId }: TapOrigin) => {
      const message = {
        message_id: messageId,
        date: 1,
        chat: { id: chatId, type: 'supergroup', title: 'Team' },
        message_thread_id: topicId,
        is_topic_message: topicId !== undefined
      } satisfies Message
      const from = { id: 1, is_bot: false, first_name: 'Player' } as const
      for (const handler of tapHandlers) await handler({ callbackQuery: { id: `tap-${nextMessageId++}`, data, message, from } })
    },

    /** Types `text` in a chat. Like grammY, each middleware runs only when the previous one calls `next`. */
    command: async (text: string, { chatId, topicId }: CommandOrigin) => {
      const msg = {
        message_id: nextMessageId++,
        date: 0,
        text,
        chat: { id: chatId, type: 'supergroup', title: 'Team' },
        from: { id: 1, is_bot: false, first_name: 'Player' },
        message_thread_id: topicId,
        is_topic_message: topicId !== undefined
      } satisfies Message
      const runFrom = async (index: number): Promise<void> => {
        await middlewares[index]?.({ msg, me: { username: BOT_USERNAME } }, () => runFrom(index + 1))
      }
      await runFrom(0)
    }
  }

  // The library boundary: the fake implements only the Bot API methods the code under test calls
  return fake as typeof fake & Bot
}
