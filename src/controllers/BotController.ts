import type TelegramBot from 'node-telegram-bot-api'
import { type SeasonManager } from '../services/SeasonManager'
import { type MessageGenerator } from '../services/MessageGenerator'
import { config } from '../config'
import { EMOJIS, MESSAGES } from '../utils/constants'
import { getDateBefore } from '../utils/dateHelpers'
import { capitalize, formatDateShort, formatDate, formatPracticeDays } from '../utils/formatters'
import { log } from '../utils/logger'

export class BotController {
  private readonly bot: TelegramBot
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly adminChatId?: string

  constructor(
    bot: TelegramBot,
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator
  ) {
    this.bot = bot
    this.seasonManager = seasonManager
    this.messageGenerator = messageGenerator
    this.adminChatId = config.telegram.adminChatId

    this.setupCommands()
    void this.registerBotCommands()
  }

  private setupCommands(): void {
    // Public commands
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg))
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg))
    this.bot.onText(/\/info/, (msg) => this.handleInfo(msg))
    this.bot.onText(/\/training/, (msg) => this.handleTraining(msg))

    // Admin-only commands
    this.bot.onText(/\/test_template/, (msg) => this.requireAdmin(msg, () => this.handleTestTemplate(msg)))
    this.bot.onText(/\/test_llm/, (msg) => this.requireAdmin(msg, () => this.handleTestLLM(msg)))
    this.bot.onText(/\/send_now/, (msg) => this.requireAdmin(msg, () => this.handleSendNow(msg)))
  }

    private async registerBotCommands() {
        // Public commands for all users
        const publicCommands = [
            {command: 'start', description: 'Start the bot'},
            {command: 'help', description: 'Show available commands'},
            {command: 'info', description: 'Show training schedule'},
            {command: 'training', description: 'Show next training'}
        ]

        // Admin-only commands
        const adminCommands = [...publicCommands,
            {command: 'test_template', description: 'Test template message'},
            {command: 'test_llm', description: 'Test LLM message generation'},
            {command: 'send_now', description: 'Send training reminder now'}
        ]

        try {
            // Set public commands for all other chats
            await this.bot.setMyCommands(publicCommands)

            if (this.adminChatId) {
                // Set admin commands for admin chat (public + admin)
                await this.bot.setMyCommands(adminCommands, {
                    scope: {type: 'chat', chat_id: parseInt(this.adminChatId)}
                })
            }
        } catch (err) {
            log.error('Registering bot commands', err)
        }
    }

  private isAdmin(chatId: number): boolean {
    return this.adminChatId !== undefined && chatId.toString() === this.adminChatId
  }

  private async requireAdmin(msg: TelegramBot.Message, handler: () => Promise<void>): Promise<void> {
    if (!this.isAdmin(msg.chat.id)) {
      log.auth('Non-admin attempted admin command', msg.from?.username || msg.from?.id, msg.chat.id)
      await this.bot.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} ${MESSAGES.ADMIN_ONLY_COMMAND}`)
      return
    }
    await handler()
  }

  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    log.command('/start', msg.chat.id, msg.from?.username || msg.from?.id)
    const helpText = `${EMOJIS.FRISBEE} Welcome to Ultimate Frisbee Training Bot!

I send training reminders to the team group 24h before each practice.

Type /help to see available commands.`

    await this.bot.sendMessage(msg.chat.id, helpText)
  }

  private async handleInfo(msg: TelegramBot.Message): Promise<void> {
    log.command('/info', msg.chat.id, msg.from?.username || msg.from?.id)
    const winterInfo = this.formatSeasonInfo('winter', config.seasons.winter, config.seasons.summer.startDate)
    const summerInfo = this.formatSeasonInfo('summer', config.seasons.summer, config.seasons.winter.startDate)

    const infoText = `${EMOJIS.CALENDAR} Training Schedule

${winterInfo}

${summerInfo}`

    await this.bot.sendMessage(msg.chat.id, infoText, { parse_mode: 'Markdown' })
  }

  private async handleTestTemplate(msg: TelegramBot.Message): Promise<void> {
    log.command('/test_template', msg.chat.id, msg.from?.username || msg.from?.id)
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()
    const practiceDay = this.seasonManager.getPracticeForDay()
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: false }, practiceDay)

    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.MEMO} Template Message:\n\n${message}`, { parse_mode: 'Markdown' })
  }

  private async handleTestLLM(msg: TelegramBot.Message): Promise<void> {
    log.command('/test_llm', msg.chat.id, msg.from?.username || msg.from?.id)
    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`)

    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()
    const practiceDay = this.seasonManager.getPracticeForDay()
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: true }, practiceDay)

    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} LLM Generated Message:\n\n${message}`, { parse_mode: 'Markdown' })
  }


  private async handleTraining(msg: TelegramBot.Message): Promise<void> {
    log.command('/training', msg.chat.id, msg.from?.username || msg.from?.id)
    const nextTraining = this.seasonManager.getNextTrainingInfo()

    const trainingText = `${EMOJIS.RUNNER} Next Training:

${EMOJIS.CALENDAR} ${formatDate(nextTraining.date)}
${EMOJIS.CLOCK} ${nextTraining.time}
${EMOJIS.LOCATION} ${nextTraining.location}`

    await this.bot.sendMessage(msg.chat.id, trainingText, { parse_mode: 'Markdown' })
  }

  private async handleSendNow(msg: TelegramBot.Message): Promise<void> {
    log.command('/send_now', msg.chat.id, msg.from?.username || msg.from?.id)
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()
    const practiceDay = this.seasonManager.getPracticeForDay()
    const useLLM = this.messageGenerator.isLLMAvailable()
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, practiceDay)

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' })
  }

  private async handleHelp(msg: TelegramBot.Message): Promise<void> {
    log.command('/help', msg.chat.id, msg.from?.username || msg.from?.id)
    const helpText = `${EMOJIS.FRISBEE} Available Commands

/info - Show training schedule for all seasons
/training - Show next training session`

    await this.bot.sendMessage(msg.chat.id, helpText)
  }

  private formatSeasonInfo(
    season: 'winter' | 'summer',
    seasonConfig: { startDate: { month: number; day: number }; practices: { day: number; time: string; location?: string }[]; location: string },
    nextSeasonStart: { month: number; day: number }
  ): string {
    const emoji = season === 'winter' ? EMOJIS.WINTER : EMOJIS.SUMMER
    const name = capitalize(season)
    const start = formatDateShort(seasonConfig.startDate)
    const end = formatDateShort(getDateBefore(nextSeasonStart))
    const practices = formatPracticeDays(seasonConfig.practices)

    return `${emoji} ${name} (${start} - ${end}):
${practices}
   ${EMOJIS.LOCATION} ${seasonConfig.location}`
  }
}