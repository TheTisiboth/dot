import { type Api } from 'grammy'
import { buildQuizPost } from './post'
import { buildAnswer } from './answer'
import { findQuizBatch } from './data'
import { type QuizBatch, type QuizQuestion } from './question'
import { type ChatTarget, senderFor } from '../telegram/sender'

export interface QuizPublisher {
  /** Image, then the long question text if any, then the poll: each one replying to the previous. Resolves to the poll's id. */
  post: (chat: ChatTarget, question: QuizQuestion) => Promise<number>;
  /** The answer behind a spoiler, replying to the poll. The poll stays open: whoever reads the chat later can still vote. */
  answer: (chat: ChatTarget, question: QuizQuestion, quizMessageId: number) => Promise<void>;
  /** The question and its answer right away (used by /test_rule). */
  preview: (chat: ChatTarget, question: QuizQuestion) => Promise<void>;
}

const sourceOf = (question: QuizQuestion): QuizBatch['source'] => {
  const batch = findQuizBatch(question.id)
  if (!batch) throw new Error(`Question ${question.id} has no batch`)
  return batch.source
}

/** Sends quiz questions and answers where it is told: what to send and when is the service's call. */
export const quizPublisher = (bot: Api): QuizPublisher => {
  const post: QuizPublisher['post'] = async (chat, question) => {
    const { intro, poll, options, correctOptionId } = buildQuizPost(question)
    const to = senderFor(bot, chat)

    let replyTo = question.image ? await to.photo(question.image) : undefined
    if (intro) replyTo = await to.plain(intro, { replyTo })
    return await to.poll(poll, options, { correctOptionId, replyTo })
  }

  const answer: QuizPublisher['answer'] = async (chat, question, quizMessageId) => {
    const html = buildAnswer(question, sourceOf(question))
    const to = senderFor(bot, chat)
    if (question.answerImage) {
      await to.photo(question.answerImage, { caption: html, spoiler: true, replyTo: quizMessageId })
    } else {
      await to.text(html, { replyTo: quizMessageId, linkPreview: false })
    }
  }

  return {
    post,
    answer,
    preview: async (chat, question) => { await answer(chat, question, await post(chat, question)) }
  }
}
