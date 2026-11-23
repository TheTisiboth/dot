import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { envVars } from '../src/config/env'
import { commandList } from '../src/commands/registry'
import { publicCommands } from '../src/commands/public'
import { practiceCommand, quizCommands } from '../src/commands/quiz'
import { trainingCommands } from '../src/commands/training'
import { statusCommand } from '../src/commands/status'
import { llmWriter } from '../src/training/messages/llmWriter'
import { trainingMessages } from '../src/training/messages/messages'
import { AttendanceMonitor } from '../src/training/attendance'
import { announcer } from '../src/training/announcer'
import { SeasonManager } from '../src/training/season'
import { makeFakeBot } from './fakes/bot'
import { makeFakeTrainingHistory } from './fakes/trainingHistory'
import { makeFakeQuizPublisher, makeFakeRulesQuiz } from './fakes/rulesQuiz'
import { testConfig } from './fixtures/config'

const readme = readFileSync('README.md', 'utf8')

/** Every command, as the admin chat's /help lists them. */
const adminHelp = (): string => {
  const config = testConfig()
  const bot = makeFakeBot()
  const seasonManager = new SeasonManager(config)
  const writer = llmWriter(config.ollama, null)
  const messages = trainingMessages(writer)
  const attendance = new AttendanceMonitor(config, seasonManager, messages, makeFakeTrainingHistory(), bot.api)
  const rulesQuiz = makeFakeRulesQuiz()
  const publisher = makeFakeQuizPublisher()
  return commandList([
    ...publicCommands({ teamChat: config.telegram.teamChat, seasonManager, attendance, mtprotoUp: () => true }),
    practiceCommand({ publisher, seasonManager }),
    ...trainingCommands({ config, api: bot.api, seasonManager, messages, announcer: announcer({ config, seasonManager, messages, attendance, bot: bot.api, rulesQuiz }), attendance, llmEnabled: false }),
    ...quizCommands(rulesQuiz, publisher, () => true),
    statusCommand({ config, seasonManager, attendance, rulesQuiz, dependencies: async () => ({}), startedAt: new Date(), version: '0.0.0' })
  ])
}

test('every env var the code or .env.example knows is documented in the README', () => {
  const exampleVars = [...readFileSync('.env.example', 'utf8').matchAll(/^([A-Z0-9_]+)=/gm)].map(m => m[1])
  const vars = new Set([...Object.keys(envVars.shape), ...exampleVars])
  assert.deepEqual([...vars].filter(name => !readme.includes(`\`${name}\``)), [])
})

test('the README command list is the admin chat /help, as a block', () => {
  assert.ok(readme.includes(`\`\`\`\n${adminHelp()}\n\`\`\``), `README.md needs this block:\n${adminHelp()}`)
})
