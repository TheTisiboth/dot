import type { Bot } from 'grammy'
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

export const BOT_USERNAME = 'dot_bot'

/** Where a command is typed: a chat, optionally a forum topic in it. */
interface CommandOrigin { chatId: number; topicId?: number }

/** A Bot API stand-in recording what is sent where. Sends to `failingChat` throw, as a Telegram outage would; set it to undefined to recover. */
export const makeFakeBot = ({ failingChat }: { failingChat?: string } = {}) => {
  let nextMessageId = 1
  const middlewares: Middleware[] = []

  const fake = {
    failingChat,
    sent: [] as SentMessage[],
    menus: [] as CommandMenu[],

    sentTo: (chatId: string | number) => fake.sent.filter(message => message.chatId === String(chatId)),

    api: {
      sendMessage: async (chatId: string | number, text: string, options: Record<string, unknown> = {}) => {
        if (String(chatId) === fake.failingChat) throw new Error('Telegram is down')
        const messageId = nextMessageId++
        fake.sent.push({ chatId: String(chatId), text, options, messageId })
        return { message_id: messageId }
      },
      setMyCommands: async (commands: readonly BotCommand[], options?: CommandMenu['options']) => {
        fake.menus.push({ commands, options })
        return true
      }
    },

    on: (_filter: 'message:text', middleware: Middleware) => { middlewares.push(middleware) },

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
