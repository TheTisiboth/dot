import { Bot } from 'grammy'
import { Ollama } from 'ollama'
import { readEnv } from './config'
import { type BotConfig, loadConfig } from './config/env'
import { SeasonManager } from './training/season'
import { MessageGenerator } from './training/messages/messageGenerator'
import { MtprotoConnection, createMtprotoClient } from './telegram/mtproto/client'
import { History } from './telegram/mtproto/history'
import { trainingHistory } from './training/history'
import { quizHistory } from './quiz/history'
import { SchedulerService } from './training/scheduler'
import { RulesQuizService } from './quiz/service'
import { HEALTH_PORT, PROBE_TIMEOUT_MS, startHealthServer } from './health/server'
import { type Command, publishCommandMenus, routeCommands } from './commands/registry'
import { publicCommands } from './commands/public'
import { trainingCommands } from './commands/training'
import { quizCommands } from './commands/quiz'
import { EMOJIS } from './shared/emojis'
import { log } from './shared/logger'
import { pollingOutageLogger } from './telegram/botApi'

class Dot {
  private readonly bot: Bot
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly mtproto: MtprotoConnection
  private readonly schedulerService: SchedulerService
  private readonly commands: Command[]
  private readonly adminChatId: string

  constructor(config: BotConfig) {
    this.adminChatId = config.telegram.adminChatId
    this.bot = new Bot(config.telegram.token)
    this.bot.api.config.use(pollingOutageLogger())
    // grammY awaits each update before the next: not awaiting keeps a slow command (LLM) from holding up the others
    this.bot.use((_ctx, next) => {
      next().catch((error: unknown) => { log.error('Bot error', error) })
    })
    this.seasonManager = new SeasonManager(config)
    this.messageGenerator = new MessageGenerator(config, config.ollama.enabled ? new Ollama({ host: config.ollama.host }) : null)
    this.mtproto = new MtprotoConnection(createMtprotoClient(config.mtproto))
    const history = new History(this.bot.api, this.mtproto)
    const rulesQuiz = new RulesQuizService(config.rulesQuiz, this.bot.api, this.seasonManager, quizHistory(history))
    this.schedulerService = new SchedulerService(
      config,
      this.seasonManager,
      this.messageGenerator,
      trainingHistory(history),
      this.bot.api,
      rulesQuiz
    )
    this.commands = [
      ...publicCommands(this.seasonManager),
      ...trainingCommands({ config, api: this.bot.api, seasonManager: this.seasonManager, messageGenerator: this.messageGenerator, scheduler: this.schedulerService }),
      ...quizCommands(rulesQuiz)
    ]
    routeCommands(this.bot, this.commands, config.telegram.adminChatId)

    this.setupErrorHandlers()
  }

  private setupErrorHandlers(): void {
    process.on('unhandledRejection', (reason) => {
      log.error('Unhandled Rejection', reason)
    })

    process.on('uncaughtException', (error) => {
      log.error('Uncaught Exception', error)
      process.exit(1)
    })

    let shuttingDown = false
    const shutdown = (signal: string): void => {
      if (shuttingDown) return
      shuttingDown = true

      log.bot(`Received ${signal}, stopping polling...`)
      void Promise.all([this.bot.stop(), this.mtproto.disconnect()]).then(() => {
        log.bot('Polling stopped, exiting')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => { shutdown('SIGTERM') })
    process.on('SIGINT', () => { shutdown('SIGINT') })
  }

  async start(): Promise<void> {
    const currentSeason = this.seasonManager.seasonOn()
    const trainingDays = this.seasonManager.getTrainingDaysString()
    const seasonConfig = this.seasonManager.seasonConfigOn()

    log.bot(`${EMOJIS.FRISBEE} Dot started!`)
    log.bot(`${EMOJIS.CALENDAR} Season: ${currentSeason} | ${EMOJIS.LOCATION} Location: ${seasonConfig.location.name}`)
    log.bot(`${EMOJIS.RUNNER} Training days: ${trainingDays}`)
    log.bot(`${EMOJIS.ROBOT} LLM: ${this.messageGenerator.getLLMProvider()}`)
    log.bot(`${EMOJIS.THUMBS_UP} Min attendance: ${seasonConfig.minAttendance}`)

    startHealthServer({ api: this.bot.api, reader: this.mtproto, messageGenerator: this.messageGenerator }, HEALTH_PORT, PROBE_TIMEOUT_MS)
    publishCommandMenus(this.bot.api, this.commands, this.adminChatId).catch((error: unknown) => {
      log.error('Registering bot commands', error)
    })

    // Connect first: a catch-up attendance check can fire as soon as the timers are armed.
    // A failure here must not take the scheduler down with it - training posts still go out,
    // and the attendance checks retry the connection on their next run.
    try {
      await this.mtproto.connect()
    } catch (error) {
      log.error('Connecting MTProto reader - attendance checks will not run until it recovers', error)
    }

    this.schedulerService.setupScheduler()

    // Polling only gives up on a rejected token or a second poller (409, e.g. a deploy overlap): exit so Docker restarts it
    this.bot.start().catch((error: unknown) => {
      log.error('Telegram polling stopped', error)
      process.exit(1)
    })
  }
}

const loadConfigOrExit = (): BotConfig => {
  try {
    return loadConfig(readEnv())
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}\n\nPlease check your .env file.`)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new Dot(loadConfigOrExit())
  void bot.start()
}
