import type { Bot } from 'grammy'
import type { Ollama } from 'ollama'
import type { BotConfig } from './config/env'
import { SeasonManager } from './training/season'
import { llmWriter } from './training/messages/llmWriter'
import { trainingMessages } from './training/messages/messages'
import { type MtprotoClient, MtprotoConnection } from './telegram/mtproto/client'
import { History } from './telegram/mtproto/history'
import { trainingHistory } from './training/history'
import { quizHistory } from './quiz/history'
import { AttendanceMonitor } from './training/attendance'
import { announcer } from './training/announcer'
import { startSchedule } from './training/schedule'
import { RulesQuizService } from './quiz/service'
import { quizPublisher } from './quiz/publisher'
import { HEALTH_PORT, PROBE_TIMEOUT_MS, startHealthServer } from './health/server'
import { publishCommandMenus, routeCommands } from './commands/registry'
import { publicCommands } from './commands/public'
import { trainingCommands } from './commands/training'
import { quizCommands } from './commands/quiz'
import { EMOJIS } from './shared/emojis'
import { log } from './shared/logger'
import { pollingOutageLogger } from './telegram/botApi'

/** The outside world the app talks to, built by the entry point. */
export interface Clients {
  bot: Bot;
  mtproto: MtprotoClient;
  ollama: Ollama | null;
}

export interface App {
  /** Starts every service; `onPollingStopped` is called when polling gives up. */
  start: (onPollingStopped: (error: unknown) => void) => Promise<void>;
  stop: () => Promise<void>;
}

/** Builds and wires every service; nothing talks to the outside until `start`. */
export const buildApp = (config: BotConfig, { bot, mtproto: mtprotoClient, ollama }: Clients): App => {
  bot.api.config.use(pollingOutageLogger())
  // grammY awaits each update before the next: not awaiting keeps a slow command (LLM) from holding up the others
  bot.use((_ctx, next) => {
    next().catch((error: unknown) => { log.error('Bot error', error) })
  })
  const seasonManager = new SeasonManager(config)
  const llm = llmWriter(config.ollama, ollama)
  const messages = trainingMessages(llm)
  const mtproto = new MtprotoConnection(mtprotoClient)
  const history = new History(bot.api, mtproto)
  const { teamChat, trainerChat, enableTrainerMessages, adminChatId } = config.telegram
  const rulesChat = config.rulesQuiz.enabled ? config.rulesQuiz.chat : undefined
  // The chats the history is read in, so a startup check can flag one the account cannot see
  const readChats: Record<string, string> = {
    team: teamChat.chatId,
    ...(enableTrainerMessages && { trainer: trainerChat.chatId }),
    ...(rulesChat && { rules: rulesChat.chatId })
  }
  const publisher = quizPublisher(bot.api)
  const rulesQuiz = new RulesQuizService(config.rulesQuiz, publisher, seasonManager, quizHistory(history))
  const attendance = new AttendanceMonitor(config, seasonManager, messages, trainingHistory(history), bot.api)
  const trainingAnnouncer = announcer({ config, seasonManager, messages, attendance, bot: bot.api, rulesQuiz })
  const commands = [
    ...publicCommands(seasonManager),
    ...trainingCommands({ config, api: bot.api, seasonManager, messages, announcer: trainingAnnouncer, attendance }),
    ...quizCommands(rulesQuiz, publisher)
  ]
  routeCommands(bot, commands, adminChatId)

  const reportUnresolvedChats = async (): Promise<void> => {
    for (const { name, error } of await history.unresolvedChats(readChats)) {
      log.error(`MTProto account cannot resolve the ${name} chat ${readChats[name]} - history reads there will fail (is the account a member, the chat among its 100 latest dialogs?)`, error)
    }
  }

  const start = async (onPollingStopped: (error: unknown) => void): Promise<void> => {
    const seasonConfig = seasonManager.seasonConfigOn()

    log.bot(`${EMOJIS.FRISBEE} Dot started!`)
    log.bot(`${EMOJIS.CALENDAR} Season: ${seasonManager.seasonOn()} | ${EMOJIS.LOCATION} Location: ${seasonConfig.location.name}`)
    log.bot(`${EMOJIS.RUNNER} Training days: ${seasonManager.getTrainingDaysString()}`)
    log.bot(`${EMOJIS.ROBOT} LLM: ${config.ollama.enabled ? `Ollama (${config.ollama.model})` : 'Template-only'}`)
    log.bot(`${EMOJIS.THUMBS_UP} Min attendance: ${seasonConfig.minAttendance}`)

    startHealthServer({ api: bot.api, reader: mtproto, llm }, HEALTH_PORT, PROBE_TIMEOUT_MS)
    publishCommandMenus(bot.api, commands, adminChatId).catch((error: unknown) => {
      log.error('Registering bot commands', error)
    })

    // Connect first: a catch-up attendance check can fire as soon as the timers are armed.
    // A failure here must not take the scheduler down with it - training posts still go out,
    // and the attendance checks retry the connection on their next run.
    try {
      await mtproto.connect()
      void reportUnresolvedChats()
    } catch (error) {
      log.error('Connecting MTProto reader - attendance checks will not run until it recovers', error)
    }

    startSchedule({ config, seasonManager, announcer: trainingAnnouncer, attendance, rulesQuiz, bot: bot.api })

    bot.start().catch(onPollingStopped)
  }

  const stop = async (): Promise<void> => {
    await Promise.all([bot.stop(), mtproto.disconnect()])
  }

  return { start, stop }
}
