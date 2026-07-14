import TelegramBot from 'node-telegram-bot-api'
import { config } from './config'
import { SeasonManager } from './services/SeasonManager'
import { MessageGenerator } from './services/MessageGenerator'
import { ReactionReader } from './services/ReactionReader'
import { SchedulerService } from './services/SchedulerService'
import { HealthServer } from './services/HealthServer'
import { BotController } from './controllers/BotController'
import { MESSAGES, EMOJIS } from './utils/constants'
import { log } from './utils/logger'
import { extractLocationName } from './utils/formatters'

class UltimateFrisbeeBot {
  private readonly bot: TelegramBot
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly reactionReader: ReactionReader
  private readonly schedulerService: SchedulerService
  private readonly healthServer: HealthServer

  constructor() {
    this.bot = new TelegramBot(config.telegram.token, { polling: true })
    this.seasonManager = new SeasonManager()
    this.messageGenerator = new MessageGenerator()
    this.reactionReader = new ReactionReader()
    this.schedulerService = new SchedulerService(
      this.seasonManager,
      this.messageGenerator,
      this.reactionReader,
      this.bot
    )
    const botController = new BotController(
      this.bot,
      this.seasonManager,
      this.messageGenerator
    )
    botController.setSchedulerService(this.schedulerService)

    this.healthServer = new HealthServer(this.bot, this.messageGenerator)
    this.setupErrorHandlers()
  }

  private setupErrorHandlers(): void {
    process.on('unhandledRejection', (reason, _promise) => {
      log.error('Unhandled Rejection', new Error(String(reason)))
    })

    process.on('uncaughtException', (error) => {
      log.error('Uncaught Exception', error)
      process.exit(1)
    })

    this.bot.on('error', (error) => {
      log.error('Bot error', error)
    })

    let shuttingDown = false
    const shutdown = (signal: string): void => {
      if (shuttingDown) return
      shuttingDown = true

      log.bot(`Received ${signal}, stopping polling...`)
      void Promise.all([this.bot.stopPolling(), this.reactionReader.disconnect()]).then(() => {
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
    log.bot(`${EMOJIS.CALENDAR} Season: ${currentSeason} | ${EMOJIS.LOCATION} Location: ${extractLocationName(seasonConfig.location)}`)
    log.bot(`${EMOJIS.RUNNER} Training days: ${trainingDays}`)
    log.bot(`${EMOJIS.ROBOT} LLM: ${this.messageGenerator.getLLMProvider()}`)
    log.bot(`${EMOJIS.THUMBS_UP} Min attendance: ${seasonConfig.minAttendance}`)

    this.healthServer.start()

    // Connect first: a catch-up attendance check can fire as soon as the timers are armed.
    // A failure here must not take the scheduler down with it - training posts still go out,
    // and the attendance checks retry the connection on their next run.
    try {
      await this.reactionReader.connect()
    } catch (error) {
      log.error('Connecting MTProto reader - attendance checks will not run until it recovers', error)
    }

    this.schedulerService.setupScheduler()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new UltimateFrisbeeBot()
  void bot.start()
}

export default UltimateFrisbeeBot