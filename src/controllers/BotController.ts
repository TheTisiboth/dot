import type TelegramBot from 'node-telegram-bot-api'
import { type SeasonManager } from '../services/SeasonManager'
import { type MessageGenerator } from '../services/MessageGenerator'
import { type SchedulerService } from '../services/SchedulerService'
import { type SeasonConfigBase, type DateConfig } from '../types'
import { config } from '../config'
import { EMOJIS, MESSAGES } from '../utils/constants'
import { getDateBefore } from '../utils/dateHelpers'
import { capitalize, formatDateShort, formatDate, formatPracticeDays } from '../utils/formatters'
import { log } from '../utils/logger'

export class BotController {
  private readonly bot: TelegramBot
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly adminChatId: string
  private schedulerService?: SchedulerService

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

  setSchedulerService(schedulerService: SchedulerService): void {
    this.schedulerService = schedulerService
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
    this.bot.onText(/\/test_trainer/, (msg) => this.requireAdmin(msg, () => this.handleTestTrainer(msg)))
    this.bot.onText(/\/preview_team/, (msg) => this.requireAdmin(msg, () => this.handlePreviewTeam(msg)))
    this.bot.onText(/\/preview_all/, (msg) => this.requireAdmin(msg, () => this.handlePreviewAll(msg)))
    this.bot.onText(/\/send_to_team/, (msg) => this.requireAdmin(msg, () => this.handleSendToTeam(msg)))
    this.bot.onText(/\/send_to_all/, (msg) => this.requireAdmin(msg, () => this.handleSendToAll(msg)))
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
            {command: 'test_template', description: 'Preview template message'},
            {command: 'test_llm', description: 'Preview LLM team message'},
            {command: 'test_trainer', description: 'Preview LLM trainer message'},
            {command: 'preview_team', description: 'Preview team message (template or LLM)'},
            {command: 'preview_all', description: 'Preview both team and trainer messages'},
            {command: 'send_to_team', description: 'Send message to team chat'},
            {command: 'send_to_all', description: 'Send messages to team and trainer chats'}
        ]

        try {
            // Set public commands for all other chats
            await this.bot.setMyCommands(publicCommands)

            // Set admin commands for admin chat (public + admin)
            await this.bot.setMyCommands(adminCommands, {
                scope: {type: 'chat', chat_id: parseInt(this.adminChatId)}
            })
        } catch (err) {
            log.error('Registering bot commands', err)
        }
    }

  private isAdmin(chatId: number): boolean {
    return chatId.toString() === this.adminChatId
  }

  private async requireAdmin(msg: TelegramBot.Message, handler: () => Promise<void>): Promise<void> {
    if (!this.isAdmin(msg.chat.id)) {
      log.auth('Non-admin attempted admin command', msg.from?.username || msg.from?.id, msg.chat.id)
      await this.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} ${MESSAGES.ADMIN_ONLY_COMMAND}`)
      return
    }
    await handler()
  }

  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    log.command('/start', msg.chat.id, msg.from?.username || msg.from?.id)
    const helpText = `${EMOJIS.FRISBEE} Welcome to Ultimate Frisbee Training Bot!

I send training reminders to the team group 24h before each practice.

Type /help to see available commands.`

    await this.sendMessage(msg.chat.id, helpText)
  }

  private async handleInfo(msg: TelegramBot.Message): Promise<void> {
    log.command('/info', msg.chat.id, msg.from?.username || msg.from?.id)
    const winterInfo = this.formatSeasonInfo('winter', config.seasons.winter, config.seasons.summer.startDate)
    const summerInfo = this.formatSeasonInfo('summer', config.seasons.summer, config.seasons.winter.startDate)

    const infoText = `${EMOJIS.CALENDAR} Training Schedule

${winterInfo}

${summerInfo}`

    await this.sendMessage(msg.chat.id, infoText, { parse_mode: 'Markdown' })
  }

  private async handleTestTemplate(msg: TelegramBot.Message): Promise<void> {
    log.command('/test_template', msg.chat.id, msg.from?.username || msg.from?.id)
    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: false }, nextTraining.practiceDay)

    await this.sendMessage(msg.chat.id, `${EMOJIS.MEMO} Template Message:\n\n${message}`, { parse_mode: 'Markdown' })
  }

  private async handleTestLLM(msg: TelegramBot.Message): Promise<void> {
    log.command('/test_llm', msg.chat.id, msg.from?.username || msg.from?.id)
    await this.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`)

    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: true }, nextTraining.practiceDay)

    await this.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} LLM Generated Message:\n\n${message}`, { parse_mode: 'Markdown' })
  }

  private async handleTestTrainer(msg: TelegramBot.Message): Promise<void> {
    log.command('/test_trainer', msg.chat.id, msg.from?.username || msg.from?.id)
    await this.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`)

    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const message = await this.messageGenerator.generateTrainerMessage(seasonConfig, { useLLM: true }, nextTraining.practiceDay)

    await this.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} Trainer LLM Generated Message:\n\n${message}`, { parse_mode: 'Markdown' })
  }


  private async handleTraining(msg: TelegramBot.Message): Promise<void> {
    log.command('/training', msg.chat.id, msg.from?.username || msg.from?.id)
    const nextTraining = this.seasonManager.getNextTrainingInfo()

    const trainingText = `${EMOJIS.RUNNER} Next Training:

${EMOJIS.CALENDAR} ${formatDate(nextTraining.date)}
${EMOJIS.CLOCK} ${nextTraining.time}
${EMOJIS.LOCATION} ${nextTraining.location}`

    await this.sendMessage(msg.chat.id, trainingText, { parse_mode: 'Markdown' })
  }

  private async handlePreviewTeam(msg: TelegramBot.Message): Promise<void> {
    log.command('/preview_team', msg.chat.id, msg.from?.username || msg.from?.id)
    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const useLLM = this.messageGenerator.isLLMAvailable()
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, nextTraining.practiceDay)

    await this.sendMessage(msg.chat.id, `${EMOJIS.FRISBEE} *Team Message Preview:*\n\n${message}`, { parse_mode: 'Markdown' })
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error'
  }

  private async handlePreviewAll(msg: TelegramBot.Message): Promise<void> {
    log.command('/preview_all', msg.chat.id, msg.from?.username || msg.from?.id)
    await this.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} Generating preview messages...`)

    try {
      const nextTraining = this.seasonManager.getNextTrainingInfo()
      const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
      const useLLM = this.messageGenerator.isLLMAvailable()

      // Generate and show team message
      const teamMessage = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, nextTraining.practiceDay)
      await this.sendMessage(msg.chat.id, `${EMOJIS.FRISBEE} *Team Message Preview:*\n\n${teamMessage}`, { parse_mode: 'Markdown' })

      // Generate and show trainer message
      const trainerMessage = await this.messageGenerator.generateTrainerMessage(seasonConfig, { useLLM }, nextTraining.practiceDay)
      await this.sendMessage(msg.chat.id, `${EMOJIS.RUNNER} *Trainer Message Preview:*\n\n${trainerMessage}`, { parse_mode: 'Markdown' })

      await this.sendMessage(msg.chat.id, `${EMOJIS.CHECK_MARK} Preview complete! Use \`/send_to_all\` to send to actual chats.`, { parse_mode: 'Markdown' })
    } catch (error) {
      const errorMessage = this.getErrorMessage(error)
      await this.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} Error: ${errorMessage}`)
    }
  }

  private async handleSendToTeam(msg: TelegramBot.Message): Promise<void> {
    log.command('/send_to_team', msg.chat.id, msg.from?.username || msg.from?.id)
    await this.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} Sending message to team chat...`)

    try {
      const nextTraining = this.seasonManager.getNextTrainingInfo()
      const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
      const useLLM = this.messageGenerator.isLLMAvailable()
      const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, nextTraining.practiceDay)

      const chatId = config.telegram.chatId
      const threadId = config.telegram.chatThreadId
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        ...(threadId && { message_thread_id: parseInt(threadId) })
      })
      await this.sendMessage(msg.chat.id, `${EMOJIS.CHECK_MARK} Message sent to team chat!`)
    } catch (error) {
      const errorMessage = this.getErrorMessage(error)
      await this.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} Error: ${errorMessage}`)
    }
  }

  private async handleSendToAll(msg: TelegramBot.Message): Promise<void> {
    log.command('/send_to_all', msg.chat.id, msg.from?.username || msg.from?.id)

    if (!this.schedulerService) {
      await this.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} Scheduler service not available`)
      return
    }

    await this.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} Sending messages to team and trainer chats...`)

    try {
      await this.schedulerService.sendScheduledMessage()
      await this.sendMessage(msg.chat.id, `${EMOJIS.CHECK_MARK} Messages sent! Check the team chat and trainer chat.`)
    } catch (error) {
      const errorMessage = this.getErrorMessage(error)
      await this.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} Error: ${errorMessage}`)
    }
  }

  private async handleHelp(msg: TelegramBot.Message): Promise<void> {
    log.command('/help', msg.chat.id, msg.from?.username || msg.from?.id)
    const helpText = `${EMOJIS.FRISBEE} Available Commands

/info - Show training schedule for all seasons
/training - Show next training session`

    await this.sendMessage(msg.chat.id, helpText)
  }

  private async sendMessage(chatId: number | string, text: string, options?: TelegramBot.SendMessageOptions): Promise<void> {
    log.bot(`Sending message to chat ${chatId}`)
    await this.bot.sendMessage(chatId, text, options)
  }

  private formatSeasonInfo(
    season: 'winter' | 'summer',
    seasonConfig: SeasonConfigBase,
    nextSeasonStart: DateConfig
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