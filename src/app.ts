import TelegramBot from 'node-telegram-bot-api'
import { config, validateConfig } from './config'
import { SeasonManager } from './services/SeasonManager'
import { MessageGenerator } from './services/MessageGenerator'
import { SchedulerService } from './services/SchedulerService'
import { BotController } from './controllers/BotController'
import { MESSAGES, EMOJIS } from './utils/constants'

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
      this.messageGenerator,
      this.schedulerService
    )

    this.setupErrorHandlers()
    this.schedulerService.setupScheduler()
  }

  private setupErrorHandlers(): void {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    })

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error)
      process.exit(1)
    })

    this.bot.on('error', (error) => {
      console.error('Bot error:', error)
    })

    this.bot.on('polling_error', (_error) => {
      console.error('Polling error:', _error)
    })
  }

  start(): void {
    const currentSeason = this.seasonManager.getCurrentSeason()
    const trainingDays = this.seasonManager.getTrainingDaysString()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()

    console.log(`${EMOJIS.FRISBEE} ${MESSAGES.BOT_STARTED}`)
    console.log(`${EMOJIS.CALENDAR} Current season: ${currentSeason}`)
    console.log(`${EMOJIS.RUNNER} Training days: ${trainingDays}`)
    console.log(`${EMOJIS.LOCATION} Location: ${seasonConfig.location}`)
    console.log(`${EMOJIS.ROBOT} LLM provider: ${this.messageGenerator.getLLMProvider()}`)

    if (!this.schedulerService.isConfigured()) {
      console.log(`${EMOJIS.WARNING} CHAT_ID not set - use ${/\/start/} command to get your chat ID for testing`)
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new UltimateFrisbeeBot()
  bot.start()
}

export default UltimateFrisbeeBot