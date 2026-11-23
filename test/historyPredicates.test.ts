import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from 'telegram'
import { isRealReply, reactionCount, repliesTo, sentAt } from '../src/telegram/mtproto/history'

const TOPIC = 7

const replyTo = (replyToMsgId: number): Api.Message =>
  new Api.Message({ id: 50, date: 1_800_000_000, replyTo: new Api.MessageReplyHeader({ replyToMsgId }) })

const plain = (): Api.Message => new Api.Message({ id: 50, date: 1_800_000_000 })

test('a message replying to the topic root is not a real reply, one replying to a message is', () => {
  assert.equal(isRealReply(replyTo(TOPIC), TOPIC), false)
  assert.equal(isRealReply(replyTo(20), TOPIC), true)
  assert.equal(isRealReply(replyTo(TOPIC), undefined), true)
  assert.equal(isRealReply(plain(), TOPIC), false)
})

test('a message replies only to the message it points at', () => {
  assert.equal(repliesTo(replyTo(20), 20), true)
  assert.equal(repliesTo(replyTo(20), 21), false)
  assert.equal(repliesTo(plain(), 20), false)
})

test('reactions are counted per emoji, none counts as zero', () => {
  const reacted = new Api.Message({
    id: 1,
    date: 0,
    reactions: new Api.MessageReactions({
      results: [new Api.ReactionCount({ reaction: new Api.ReactionEmoji({ emoticon: '👍' }), count: 3 })]
    })
  })

  assert.equal(reactionCount(reacted, '👍'), 3)
  assert.equal(reactionCount(reacted, '❤'), 0)
  assert.equal(reactionCount(plain(), '👍'), 0)
})

test('the send time comes from the unix seconds Telegram stores', () => {
  assert.equal(sentAt(plain()).getTime(), 1_800_000_000_000)
})
