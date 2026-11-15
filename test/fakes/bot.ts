import type TelegramBot from 'node-telegram-bot-api'

interface SentMessage {
  chatId: string;
  text: string;
  options: TelegramBot.SendMessageOptions;
  messageId: number;
}

interface CommandMenu {
  commands: TelegramBot.BotCommand[];
  options?: { scope?: TelegramBot.BotCommandScope };
}

type TextHandler = (msg: TelegramBot.Message, match: RegExpExecArray | null) => unknown

/** Where a command is typed: a chat, optionally a forum topic in it. */
interface CommandOrigin { chatId: number; topicId?: number }

/** A Bot API stand-in recording what is sent where. Sends to `failingChat` throw, as a Telegram outage would. */
export const makeFakeBot = ({ failingChat }: { failingChat?: string } = {}) => {
  let nextMessageId = 1
  const handlers: Array<{ regexp: RegExp; handler: TextHandler }> = []
  let onPollingError: ((error: Error) => void) | undefined

  const fake = {
    sent: [] as SentMessage[],
    menus: [] as CommandMenu[],
    pollingStops: 0,
    pollingStarts: 0,

    sentTo: (chatId: string | number) => fake.sent.filter(message => message.chatId === String(chatId)),

    sendMessage: async (chatId: string | number, text: string, options: TelegramBot.SendMessageOptions = {}) => {
      if (String(chatId) === failingChat) throw new Error('Telegram is down')
      const messageId = nextMessageId++
      fake.sent.push({ chatId: String(chatId), text, options, messageId })
      return { message_id: messageId }
    },

    onText: (regexp: RegExp, handler: TextHandler) => { handlers.push({ regexp, handler }) },
    setMyCommands: async (commands: TelegramBot.BotCommand[], options?: CommandMenu['options']) => {
      fake.menus.push({ commands, options })
      return true
    },

    on: (event: string, listener: (error: Error) => void) => { if (event === 'polling_error') onPollingError = listener },
    stopPolling: async () => { fake.pollingStops++ },
    startPolling: async () => { fake.pollingStarts++ },

    /** Raises a polling error the way the library does. */
    failPolling: (error: Error) => { onPollingError?.(error) },

    /**
     * Types `text` in a chat. The one place that knows how the library dispatches commands:
     * like node-telegram-bot-api, every handler whose pattern matches runs.
     */
    command: async (text: string, { chatId, topicId }: CommandOrigin) => {
      const msg: TelegramBot.Message = {
        message_id: nextMessageId++,
        date: 0,
        text,
        chat: { id: chatId, type: 'supergroup' },
        from: { id: 1, is_bot: false, first_name: 'Player' },
        message_thread_id: topicId,
        is_topic_message: topicId !== undefined
      }
      const matching = handlers.flatMap(({ regexp, handler }) => {
        const match = regexp.exec(text)
        return match ? [handler(msg, match)] : []
      })
      await Promise.all(matching)
    }
  }

  // The library boundary: the fake implements only the Bot API methods the code under test calls
  return fake as typeof fake & TelegramBot
}
