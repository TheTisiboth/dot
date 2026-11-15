import { Bot } from 'grammy'
import { config } from './config'
import { SeasonManager } from './services/SeasonManager'
import { MessageGenerator } from './services/MessageGenerator'
import { ReactionReader } from './services/ReactionReader'
import { SchedulerService } from './services/SchedulerService'
import { RulesQuizService } from './services/RulesQuizService'
import { HealthServer } from './services/HealthServer'
import { type Command, publishCommandMenus, routeCommands } from './commands/registry'
import { publicCommands } from './commands/public'
import { trainingCommands } from './commands/training'
import { quizCommands } from './commands/quiz'
import { MESSAGES, EMOJIS } from './utils/constants'
import { log } from './utils/logger'

class UltimateFrisbeeBot {
  private readonly bot: Bot
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly reactionReader: ReactionReader
  private readonly schedulerService: SchedulerService
  private readonly healthServer: HealthServer
  private readonly commands: Command[]

  constructor() {
    this.bot = new Bot(config.telegram.token)
    // grammY awaits each update before the next: not awaiting keeps a slow command (LLM) from holding up the others
    this.bot.use((_ctx, next) => {
      next().catch((error: unknown) => { log.error('Bot error', error) })
    })
    this.seasonManager = new SeasonManager()
    this.messageGenerator = new MessageGenerator()
    this.reactionReader = new ReactionReader()
    const rulesQuiz = new RulesQuizService(this.bot.api, this.seasonManager, this.reactionReader)
    this.schedulerService = new SchedulerService(
      this.seasonManager,
      this.messageGenerator,
      this.reactionReader,
      this.bot.api,
      rulesQuiz
    )
    this.commands = [
      ...publicCommands(this.seasonManager),
      ...trainingCommands({ api: this.bot.api, seasonManager: this.seasonManager, messageGenerator: this.messageGenerator, scheduler: this.schedulerService }),
      ...quizCommands(rulesQuiz)
    ]
    routeCommands(this.bot, this.commands, config.telegram.adminChatId)

    this.healthServer = new HealthServer(this.bot.api, this.messageGenerator)
    this.setupErrorHandlers()
  }

  private setupErrorHandlers(): void {
    process.on('unhandledRejection', (reason) => {
      log.error('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)))
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
      void Promise.all([this.bot.stop(), this.reactionReader.disconnect()]).then(() => {
        log.bot('Polling stopped, exiting')
        process.exit(0)
      })
    }

    process.on('SIGTERM', () => { shutdown('SIGTERM') })
    process.on('SIGINT', () => { shutdown('SIGINT') })
  }

  async start(): Promise<void> {
    const currentSeason = this.seasonManager.getCurrentSeason()
    const trainingDays = this.seasonManager.getTrainingDaysString()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()

    log.bot(`${EMOJIS.FRISBEE} ${MESSAGES.BOT_STARTED}`)
    log.bot(`${EMOJIS.CALENDAR} Season: ${currentSeason} | ${EMOJIS.LOCATION} Location: ${seasonConfig.location.name}`)
    log.bot(`${EMOJIS.RUNNER} Training days: ${trainingDays}`)
    log.bot(`${EMOJIS.ROBOT} LLM: ${this.messageGenerator.getLLMProvider()}`)
    log.bot(`${EMOJIS.THUMBS_UP} Min attendance: ${seasonConfig.minAttendance}`)

    this.healthServer.start()
    publishCommandMenus(this.bot.api, this.commands, config.telegram.adminChatId).catch((error: unknown) => {
      log.error('Registering bot commands', error)
    })

    // Connect first: a catch-up attendance check can fire as soon as the timers are armed.
    // A failure here must not take the scheduler down with it - training posts still go out,
    // and the attendance checks retry the connection on their next run.
    try {
      await this.reactionReader.connect()
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new UltimateFrisbeeBot()
  void bot.start()
}
