import type { Server } from 'node:http'
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
import { PROBE_TIMEOUT_MS, checkDependencies, startHealthServer } from './health/server'
import { publishCommandMenus, routeCommands } from './commands/registry'
import { publicCommands } from './commands/public'
import { trainingCommands } from './commands/training'
import { quizCommands } from './commands/quiz'
import { statusCommand } from './commands/status'
import { EMOJIS } from './shared/emojis'
import { withTimeout } from './shared/async'
import { log } from './shared/logger'
import { pollingOutageLogger } from './telegram/botApi'

// Below Docker's 10s stop grace period, so the bot exits on its own before being killed
export const SHUTDOWN_DEADLINE_MS = 5_000

/** The outside world the app talks to, built by the entry point. */
export interface Clients {
  bot: Bot;
  mtproto: MtprotoClient;
  ollama: Ollama | null;
}

export interface App {
  /** Starts every service; resolves once polling runs. `onPollingStopped` is called when polling gives up. */
  start: (onPollingStopped: (error: unknown) => void) => Promise<void>;
  stop: () => Promise<void>;
}

/** Builds and wires every service; nothing talks to the outside until `start`. */
export const buildApp = (config: BotConfig, { bot, mtproto: mtprotoClient, ollama }: Clients, healthPort: number, version: string): App => {
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
  const dependencies = { api: bot.api, reader: mtproto, llm }
  const commands = [
    ...publicCommands({ teamChat, seasonManager, attendance, mtprotoUp: () => mtproto.isConnected() }),
    ...trainingCommands({ config, api: bot.api, seasonManager, messages, announcer: trainingAnnouncer, attendance, llmEnabled: llm.enabled }),
    ...quizCommands(rulesQuiz, publisher, () => mtproto.isConnected()),
    statusCommand({ config, seasonManager, attendance, rulesQuiz, dependencies: () => checkDependencies(dependencies, PROBE_TIMEOUT_MS), startedAt: new Date(), version })
  ]
  routeCommands(bot, commands, adminChatId)

  const reportUnresolvedChats = async (): Promise<void> => {
    for (const { name, error } of await history.unresolvedChats(readChats)) {
      log.error(`MTProto account cannot resolve the ${name} chat ${readChats[name]} - history reads there will fail (is the account a member, the chat among its 100 latest dialogs?)`, error)
    }
  }

  let health: Server | undefined
  let stopSchedule: (() => Promise<void>) | undefined

  const start = async (onPollingStopped: (error: unknown) => void): Promise<void> => {
    health = startHealthServer(dependencies, healthPort, PROBE_TIMEOUT_MS)
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

    stopSchedule = startSchedule({ config, seasonManager, announcer: trainingAnnouncer, attendance, rulesQuiz, bot: bot.api })

    await new Promise<void>(resolve => {
      bot.start({ onStart: () => { resolve() } }).catch((error: unknown) => {
        onPollingStopped(error)
        resolve()
      })
    })

    const seasonConfig = seasonManager.seasonConfigOn()
    const llmName = config.ollama.enabled ? `Ollama (${config.ollama.model})` : 'Template-only'
    log.bot(`${EMOJIS.FRISBEE} Dot started | ${EMOJIS.CALENDAR} ${seasonManager.seasonOn()} at ${seasonConfig.location.name} | ${EMOJIS.RUNNER} ${seasonManager.getTrainingDaysString()} | ${EMOJIS.ROBOT} LLM: ${llmName} | ${EMOJIS.THUMBS_UP} min ${seasonConfig.minAttendance}`)
  }

  /** Stops every service, giving up after SHUTDOWN_DEADLINE_MS: a hanging one must not hold the exit. */
  const stop = async (): Promise<void> => {
    attendance.stop()
    rulesQuiz.stop()
    const stopped = Promise.all([
      bot.stop(),
      stopSchedule?.(),
      new Promise(resolve => { if (health) health.close(resolve); else resolve(undefined) }),
      mtproto.disconnect()
    ])
    try {
      await withTimeout(stopped, SHUTDOWN_DEADLINE_MS, `Shutdown did not finish within ${SHUTDOWN_DEADLINE_MS / 1000}s`)
    } catch (error) {
      log.error('Stopping', error)
    }
  }

  return { start, stop }
}
