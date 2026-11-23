import type { InlineKeyboardMarkup } from 'grammy/types'
import { type RulesQuizService } from '../quiz/service'
import { type QuizPublisher } from '../quiz/publisher'
import { QUIZ_QUESTIONS, findQuizQuestion, isSignalQuestion } from '../quiz/data'
import { modeFor, questionsFor, randomItem } from '../quiz/picker'
import { type QuizMode, type QuizQuestion } from '../quiz/question'
import { type SeasonManager } from '../training/season'
import { LEVELS, MODES } from '../quiz/post'
import { type ModeStats, type QuizStats, type Round } from '../quiz/stats'
import { EMOJIS } from '../shared/emojis'
import { withTimeout } from '../shared/async'
import { formatDate } from '../shared/formatters'
import { log } from '../shared/logger'
import { type ChatTarget } from '../telegram/sender'
import { type Command } from './registry'

// The whole rules chat history is read, page by page: a few seconds, unless MTProto hangs
export const QUIZ_STATS_TIMEOUT_MS = 20_000

const roundLine = ({ completed, asked, total, focus }: Round): string => {
  const pool = focus === undefined ? 'Round' : `${focus ? 'Hand signals' : 'Other questions'}: round`
  return `${pool} ${completed + 1} (${completed} completed): ${asked} of ${total} asked`
}

const modeSection = ({ mode, rounds, bySource, byDifficulty }: ModeStats, current: boolean): string => [
  `${MODES[mode]}${current ? ' · next training' : ''}`,
  ...rounds.map(roundLine),
  bySource.map(({ name, asked, total }) => `${name} ${asked}/${total}`).join(' · '),
  byDifficulty.map(({ difficulty, asked, total }) => `${LEVELS[difficulty]} ${asked}/${total}`).join(' · ')
].join('\n')

const statsText = ({ current, modes, latest }: QuizStats): string => {
  const asked = latest.length > 0
    ? latest.map(({ questionId, askedAt }) => `${formatDate(askedAt)} · ${questionId}`).join('\n')
    : 'No question asked yet'
  return `${EMOJIS.QUESTION} Quiz rounds, asked in the current round / total

${modes.map(stats => modeSection(stats, stats.mode === current)).join('\n\n')}

Last asked
${asked}`
}

/** Undefined when the history cannot be read in time: the reply says so rather than hanging. */
const readStats = async (rulesQuiz: RulesQuizService): Promise<QuizStats | undefined> => {
  try {
    return await withTimeout(rulesQuiz.stats(), QUIZ_STATS_TIMEOUT_MS, `Quiz stats not read within ${QUIZ_STATS_TIMEOUT_MS / 1000}s`)
  } catch (error) {
    log.error('Reading quiz stats', error)
    return undefined
  }
}

/** Admin commands to drive the rules quiz by hand. `mtprotoUp` says whether the history can be read. */
export const quizCommands = (rulesQuiz: RulesQuizService, publisher: QuizPublisher, mtprotoUp: () => boolean): Command[] => [
  {
    name: 'quiz_preview',
    description: 'Preview a quiz question and its answer here',
    usage: '[id]',
    adminOnly: true,
    run: async ({ args: id, chat, reply }) => {
      const question = id ? findQuizQuestion(id) : await rulesQuiz.pickNext()
      if (!question) {
        await reply.plain(`${EMOJIS.CROSS_MARK} No quiz question with id ${id}.`)
        return
      }
      await publisher.preview(chat, question)
    }
  },
  {
    name: 'quiz_post',
    description: 'Post the next quiz question to the rules chat',
    adminOnly: true,
    run: async ({ reply }) => {
      const question = await rulesQuiz.postNext()
      await reply.plain(`${EMOJIS.CHECK_MARK} Quiz question posted: ${question.id} (${question.difficulty})`)
    }
  },
  {
    name: 'quiz_answer',
    description: 'Post the answer to the latest quiz question now',
    adminOnly: true,
    run: async ({ reply }) => {
      const question = await rulesQuiz.answerLatest()
      await reply.plain(question
        ? `${EMOJIS.CHECK_MARK} Quiz answer posted: ${question.id}`
        : `${EMOJIS.WARNING} Nothing to answer: no quiz question in the rules chat, or the latest one is answered already. A /quiz_preview comes with its answer.`)
    }
  },
  {
    name: 'quiz_stats',
    description: 'Show where the quiz rounds stand and the last questions asked',
    adminOnly: true,
    run: async ({ reply }) => {
      const stats = mtprotoUp() ? await readStats(rulesQuiz) : undefined
      await reply.plain(stats
        ? statsText(stats)
        : `${EMOJIS.WARNING} Can't read the rules chat history right now, so no quiz stats. Try again in a few minutes.`)
    }
  }
]

// Keeps a tapping spree from flooding the chat (and the bot's Telegram send quota)
export const PRACTICE_INTERVAL_MS = 5_000

type PracticePool = QuizMode | 'signals'
const isPracticePool = (data: string): data is PracticePool => data === 'signals' || Object.hasOwn(MODES, data)

const practiceQuestions = (pool: PracticePool): QuizQuestion[] =>
  pool === 'signals' ? QUIZ_QUESTIONS.filter(q => isSignalQuestion(q.id)) : questionsFor(QUIZ_QUESTIONS, pool)

// The pool rides in the button data: nothing to remember between taps, nor to lose on restart
const practiceButtons = (pool: PracticePool): InlineKeyboardMarkup => ({
  inline_keyboard: [[
    { text: 'Another', callback_data: `quiz:${pool}` },
    { text: 'Indoor', callback_data: 'quiz:indoor' },
    { text: 'Outdoor', callback_data: 'quiz:outdoor' },
    { text: 'Signals', callback_data: 'quiz:signals' }
  ]]
})

interface PracticeDeps {
  publisher: QuizPublisher;
  seasonManager: Pick<SeasonManager, 'nextTraining'>;
  random?: () => number;
}

/**
 * /quiz in a private chat: a random question and its answer, never the rules chat's. Its history
 * is the quiz memory and is read in the rules chat only, so practice changes nothing there.
 */
export const practiceCommand = ({ publisher, seasonManager, random = Math.random }: PracticeDeps): Command => {
  // shortcut: lost on restart, which only lifts the limit for a few seconds
  const lastSentAt = new Map<string, number>()

  const practise = async (chat: ChatTarget, pool: PracticePool): Promise<void> => {
    const now = Date.now()
    if (now - (lastSentAt.get(chat.chatId) ?? -Infinity) < PRACTICE_INTERVAL_MS) return
    lastSentAt.set(chat.chatId, now)
    await publisher.preview(chat, randomItem(practiceQuestions(pool), random), practiceButtons(pool))
  }

  return {
    name: 'quiz',
    description: 'Practise with a random rules quiz question (private chat)',
    privateOnly: true,
    run: ({ chat }) => practise(chat, modeFor(seasonManager.nextTraining().season)),
    onButton: async ({ data, chat }) => { if (isPracticePool(data)) await practise(chat, data) }
  }
}
