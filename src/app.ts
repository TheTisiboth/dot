import TelegramBot from 'node-telegram-bot-api'
import { config, validateConfig } from './config'
import { SeasonManager } from './services/SeasonManager'
import { MessageGenerator } from './services/MessageGenerator'
import { SchedulerService } from './services/SchedulerService'
import { BotController } from './controllers/BotController'
import { MESSAGES, EMOJIS } from './utils/constants'
import { log } from './utils/logger'

class UltimateFrisbeeBot {
  private readonly bot: TelegramBot
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly schedulerService: SchedulerService

  constructor() {
    validateConfig()

    this.bot = new TelegramBot(config.telegram.token, { polling: true })
    this.seasonManager = new SeasonManager()
    this.messageGenerator = new MessageGenerator()
    this.schedulerService = new SchedulerService(
      this.seasonManager,
      this.messageGenerator,
      this.bot
    )
    new BotController(
      this.bot,
      this.seasonManager,
      this.messageGenerator
    )

    this.setupErrorHandlers()
    this.schedulerService.setupScheduler()
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
  }

  start(): void {
    const currentSeason = this.seasonManager.getCurrentSeason()
    const trainingDays = this.seasonManager.getTrainingDaysString()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()

    log.bot(`${EMOJIS.FRISBEE} ${MESSAGES.BOT_STARTED}`)
    log.bot(`${EMOJIS.CALENDAR} Current season: ${currentSeason}`)
    log.bot(`${EMOJIS.RUNNER} Training days: ${trainingDays}`)
    log.bot(`${EMOJIS.LOCATION} Location: ${seasonConfig.location}`)
    log.bot(`${EMOJIS.ROBOT} LLM provider: ${this.messageGenerator.getLLMProvider()}`)

    if (!this.schedulerService.isConfigured()) {
      log.bot(`${EMOJIS.WARNING} CHAT_ID not set - use /start command to get your chat ID for testing`)
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new UltimateFrisbeeBot()
  bot.start()
}

export default UltimateFrisbeeBot