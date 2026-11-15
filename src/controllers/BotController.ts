import type { Api, Bot } from 'grammy'
import type { Message } from 'grammy/types'
import { type SeasonManager } from '../services/SeasonManager'
import { type MessageGenerator } from '../services/MessageGenerator'
import { type SchedulerService } from '../services/SchedulerService'
import { type RulesQuizService } from '../services/RulesQuizService'
import { findQuizQuestion } from '../data/rules-quiz'
import { type SeasonConfigBase, type DateConfig } from '../types'
import { config } from '../config'
import { EMOJIS, MESSAGES } from '../utils/constants'
import { getDateBefore } from '../utils/dateHelpers'
import { capitalize, formatDateShort, formatDate, formatPracticeDays } from '../utils/formatters'
import { log } from '../utils/logger'
import { commandPattern, threadOptions } from '../utils/telegram'

/** One declaration per command: it drives the routing, the admin guard, the logging, the error reply and the menus. */
interface Command {
  name: string;
  description: string;
  /** Admin commands exist in the admin chat only: elsewhere they are ignored silently. */
  adminOnly?: boolean;
  run: (msg: Message, args: string) => Promise<void>;
}

export class BotController {
  private readonly bot: Bot
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly rulesQuiz: RulesQuizService
  private readonly adminChatId: string
  private schedulerService?: SchedulerService

  constructor(
    bot: Bot,
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    rulesQuiz: RulesQuizService
  ) {
    this.bot = bot
    this.seasonManager = seasonManager
    this.messageGenerator = messageGenerator
    this.rulesQuiz = rulesQuiz
    this.adminChatId = config.telegram.adminChatId

    const commands = this.commands()
    for (const command of commands) this.register(command)
    void this.registerBotCommands(commands)
  }

  setSchedulerService(schedulerService: SchedulerService): void {
    this.schedulerService = schedulerService
  }

  private commands(): Command[] {
    return [
      { name: 'start', description: 'Start the bot', run: msg => this.handleStart(msg) },
      { name: 'help', description: 'Show available commands', run: msg => this.handleHelp(msg) },
      { name: 'info', description: 'Show training schedule', run: msg => this.handleInfo(msg) },
      { name: 'training', description: 'Show next training', run: msg => this.handleTraining(msg) },
      { name: 'test_template', description: 'Preview template message', adminOnly: true, run: msg => this.handleTestTemplate(msg) },
      { name: 'test_llm', description: 'Preview LLM team message', adminOnly: true, run: msg => this.handleTestLLM(msg) },
      { name: 'test_trainer', description: 'Preview LLM trainer message', adminOnly: true, run: msg => this.handleTestTrainer(msg) },
      { name: 'test_key', description: 'Preview key-holder message', adminOnly: true, run: msg => this.handleTestKey(msg) },
      { name: 'preview_team', description: 'Preview team message (template or LLM)', adminOnly: true, run: msg => this.handlePreviewTeam(msg) },
      { name: 'preview_all', description: 'Preview both team and trainer messages', adminOnly: true, run: msg => this.handlePreviewAll(msg) },
      { name: 'send_to_team', description: 'Send message to team chat', adminOnly: true, run: msg => this.handleSendToTeam(msg) },
      { name: 'send_to_all', description: 'Send messages to team and trainer chats', adminOnly: true, run: msg => this.handleSendToAll(msg) },
      { name: 'attendance', description: 'Show live 👍 count on the training post', adminOnly: true, run: msg => this.handleAttendance(msg) },
      { name: 'test_rule', description: 'Preview a rules quiz question and its answer here: /test_rule [id]', adminOnly: true, run: (msg, args) => this.handleTestRule(msg, args) },
      { name: 'send_rule', description: 'Post the next rules quiz question to the rules chat', adminOnly: true, run: msg => this.handleSendRule(msg) },
      { name: 'answer_rule', description: 'Answer the latest rules quiz poll now', adminOnly: true, run: msg => this.handleAnswerRule(msg) }
    ]
  }

  private register({ name, adminOnly, run }: Command): void {
    this.bot.on('message:text').hears(commandPattern(name), async (ctx) => {
      const [, target, args = ''] = ctx.match
      if (target && target.toLowerCase() !== ctx.me.username.toLowerCase()) return

      const { chat, from, message_thread_id: threadId } = ctx.msg
      const user = from?.username || from?.id
      if (adminOnly && !this.isAdmin(chat.id)) {
        log.auth(`Non-admin attempted /${name}`, user, chat.id)
        return
      }

      log.command(`/${name}`, chat.id, user, threadId)
      try {
        await run(ctx.msg, args.trim())
      } catch (error) {
        log.error(`/${name}`, error)
        await this.reply(ctx.msg, `${EMOJIS.CROSS_MARK} Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })
  }

  private async registerBotCommands(commands: Command[]) {
    const menu = (list: Command[]) => list.map(({ name, description }) => ({ command: name, description }))

    try {
      await this.bot.api.setMyCommands(menu(commands.filter(({ adminOnly }) => !adminOnly)))
      await this.bot.api.setMyCommands(menu(commands), {
        scope: {type: 'chat', chat_id: parseInt(this.adminChatId)}
      })
    } catch (err) {
      log.error('Registering bot commands', err)
    }
  }

  private isAdmin(chatId: number): boolean {
    return chatId.toString() === this.adminChatId
  }

  private async handleStart(msg: Message): Promise<void> {
    const helpText = `${EMOJIS.FRISBEE} Welcome to Ultimate Frisbee Training Bot!

I send training reminders to the team group 24h before each practice.

Type /help to see available commands.`

    await this.reply(msg, helpText)
  }

  private async handleInfo(msg: Message): Promise<void> {
    const winterInfo = this.formatSeasonInfo('winter', config.seasons.winter, config.seasons.summer.startDate)
    const summerInfo = this.formatSeasonInfo('summer', config.seasons.summer, config.seasons.winter.startDate)

    const infoText = `${EMOJIS.CALENDAR} Training Schedule

${winterInfo}

${summerInfo}`

    await this.reply(msg, infoText, { parse_mode: 'Markdown' })
  }

  private async handleTestTemplate(msg: Message): Promise<void> {
    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: false }, nextTraining.practiceDay)

    await this.reply(msg, `${EMOJIS.MEMO} Template Message:\n\n${message}`, { parse_mode: 'Markdown' })
  }

  private async handleTestLLM(msg: Message): Promise<void> {
    await this.reply(msg, `${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`)

    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: true }, nextTraining.practiceDay)

    await this.reply(msg, `${EMOJIS.ROBOT} LLM Generated Message:\n\n${message}`, { parse_mode: 'Markdown' })
  }

  private async handleTestTrainer(msg: Message): Promise<void> {
    await this.reply(msg, `${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`)

    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const message = await this.messageGenerator.generateTrainerMessage(seasonConfig, { useLLM: true }, nextTraining.practiceDay)

    await this.reply(msg, `${EMOJIS.ROBOT} Trainer LLM Generated Message:\n\n${message}`, { parse_mode: 'Markdown' })
  }

  private async handleTestKey(msg: Message): Promise<void> {
    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const message = this.messageGenerator.generateKeyMessage()
    const status = seasonConfig.keyMessageEnabled ? '' : `\n\n${EMOJIS.WARNING} Disabled for ${seasonConfig.season}: it will not be sent.`

    await this.reply(msg, `${EMOJIS.KEY} Key Message:\n\n${message}${status}`, { parse_mode: 'Markdown' })
  }

  private async handleTraining(msg: Message): Promise<void> {
    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const timeLines = nextTraining.throwingTime
      ? `${EMOJIS.FIRE} Throwing: ${nextTraining.throwingTime}\n${EMOJIS.CLOCK} Training: ${nextTraining.time}`
      : `${EMOJIS.CLOCK} ${nextTraining.time}`

    const trainingText = `${EMOJIS.RUNNER} Next Training:

${EMOJIS.CALENDAR} ${formatDate(nextTraining.date)}
${timeLines}
${EMOJIS.LOCATION} ${nextTraining.location}`

    await this.reply(msg, trainingText, { parse_mode: 'Markdown' })
  }

  private async handlePreviewTeam(msg: Message): Promise<void> {
    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const useLLM = this.messageGenerator.isLLMAvailable()
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, nextTraining.practiceDay)

    await this.reply(msg, `${EMOJIS.FRISBEE} *Team Message Preview:*\n\n${message}`, { parse_mode: 'Markdown' })
  }

  private async handlePreviewAll(msg: Message): Promise<void> {
    await this.reply(msg, `${EMOJIS.ROBOT} Generating preview messages...`)

    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const useLLM = this.messageGenerator.isLLMAvailable()

    const teamMessage = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, nextTraining.practiceDay)
    await this.reply(msg, `${EMOJIS.FRISBEE} *Team Message Preview:*\n\n${teamMessage}`, { parse_mode: 'Markdown' })

    if (seasonConfig.keyMessageEnabled) {
      const keyMessage = this.messageGenerator.generateKeyMessage()
      await this.reply(msg, `${EMOJIS.KEY} *Key Message Preview:*\n\n${keyMessage}`, { parse_mode: 'Markdown' })
    } else {
      await this.reply(msg, `${EMOJIS.KEY} Key message disabled for ${seasonConfig.season}`)
    }

    const trainerMessage = await this.messageGenerator.generateTrainerMessage(seasonConfig, { useLLM }, nextTraining.practiceDay)
    await this.reply(msg, `${EMOJIS.RUNNER} *Trainer Message Preview:*\n\n${trainerMessage}`, { parse_mode: 'Markdown' })

    await this.reply(msg, `${EMOJIS.CHECK_MARK} Preview complete! Use \`/send_to_all\` to send to actual chats.`, { parse_mode: 'Markdown' })
  }

  private async handleSendToTeam(msg: Message): Promise<void> {
    await this.reply(msg, `${EMOJIS.ROBOT} Sending message to team chat...`)

    const nextTraining = this.seasonManager.getNextTrainingInfo()
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const useLLM = this.messageGenerator.isLLMAvailable()
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, nextTraining.practiceDay)

    await this.bot.api.sendMessage(config.telegram.chatId, message, {
      parse_mode: 'Markdown',
      ...threadOptions(config.telegram.chatThreadId)
    })
    await this.reply(msg, `${EMOJIS.CHECK_MARK} Message sent to team chat!`)
  }

  private async handleSendToAll(msg: Message): Promise<void> {
    if (!this.schedulerService) {
      await this.reply(msg, `${EMOJIS.CROSS_MARK} Scheduler service not available`)
      return
    }

    await this.reply(msg, `${EMOJIS.ROBOT} Sending messages to team and trainer chats...`)
    await this.schedulerService.sendScheduledMessage()
    await this.reply(msg, `${EMOJIS.CHECK_MARK} Messages sent! Check the team chat and trainer chat.`)
  }

  private async handleAttendance(msg: Message): Promise<void> {
    if (!this.schedulerService) {
      await this.reply(msg, `${EMOJIS.CROSS_MARK} Scheduler service not available`)
      return
    }

    const attendance = await this.schedulerService.inspectAttendance()

    if (!attendance) {
      await this.reply(msg, `${EMOJIS.WARNING} No training post found for the next training - nothing to count yet.`)
      return
    }

    const { count, threshold, pollMessageId, training } = attendance
    const status = count >= threshold ? `${EMOJIS.CHECK_MARK} Enough players` : `${EMOJIS.WARNING} Below threshold`
    const { reminderHoursBefore, cancelHoursBefore } = config.attendance

    const text = `${EMOJIS.THUMBS_UP} *Attendance*

${status}: *${count}* / *${threshold}*

${EMOJIS.CALENDAR} Training: ${formatDate(training.date)} at ${training.time}
${EMOJIS.MEMO} Poll message id: \`${pollMessageId}\`
${EMOJIS.CLOCK} Reminder ${reminderHoursBefore}h before, cancellation ${cancelHoursBefore}h before`

    await this.reply(msg, text, { parse_mode: 'Markdown' })
  }

  private async handleSendRule(msg: Message): Promise<void> {
    const question = await this.rulesQuiz.postNext()
    await this.reply(msg, `${EMOJIS.CHECK_MARK} Rules quiz posted: ${question.id} (${question.difficulty})`)
  }

  private async handleAnswerRule(msg: Message): Promise<void> {
    const question = await this.rulesQuiz.answerLatest()
    const text = question
      ? `${EMOJIS.CHECK_MARK} Rules quiz answered: ${question.id}`
      : `${EMOJIS.WARNING} Nothing to answer in the rules chat: no quiz poll there, or the latest one is already answered. (/test_rule previews come with their answer.)`
    await this.reply(msg, text)
  }

  private async handleTestRule(msg: Message, id: string): Promise<void> {
    const question = id ? findQuizQuestion(id) : await this.rulesQuiz.pickNext()

    if (!question) {
      await this.reply(msg, `${EMOJIS.CROSS_MARK} Unknown question id: ${id}`)
      return
    }

    await this.rulesQuiz.preview({ chatId: msg.chat.id.toString(), threadId: this.topicId(msg)?.toString() }, question)
  }

  private async handleHelp(msg: Message): Promise<void> {
    const helpText = `${EMOJIS.FRISBEE} Available Commands

/info - Show training schedule for all seasons
/training - Show next training session`

    await this.reply(msg, helpText)
  }

  private async reply(msg: Message, text: string, options?: Parameters<Api['sendMessage']>[2]): Promise<void> {
    const threadId = this.topicId(msg)
    log.bot(`Sending message to chat ${msg.chat.id}${threadId ? ` (thread ${threadId})` : ''}`)
    await this.bot.api.sendMessage(msg.chat.id, text, {
      ...options,
      ...threadOptions(threadId)
    })
  }

  /** The topic a command came from; outside forum topics message_thread_id points at a reply thread instead. */
  private topicId(msg: Message): number | undefined {
    return msg.is_topic_message ? msg.message_thread_id : undefined
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
