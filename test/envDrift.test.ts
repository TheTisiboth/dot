import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { envVars } from '../src/config/env'

// Read by the runtime (cron, dates), not by our code
const RUNTIME_VARS = ['TZ']

const codeVars = new Set(Object.keys(envVars.shape))

const sourcesOutsideConfig = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .filter(file => file.endsWith('.ts') && !file.startsWith('config/'))

const botService = /^ {2}frisbee-bot:\n([\s\S]*?)(?=^ {2}\S)/m.exec(readFileSync('docker-compose.yml', 'utf8'))?.[1] ?? ''
const composeEntries = [...botService.matchAll(/^\s+- ([A-Z0-9_]+)=(.*)$/gm)].map(([, name, value]) => ({ name, value }))
const composeVars = new Set(composeEntries.map(({ name }) => name))

const exampleVars = new Set([...readFileSync('.env.example', 'utf8').matchAll(/^([A-Z0-9_]+)=/gm)].map(m => m[1]))

test('every env var the code reads reaches the bot container', () => {
  assert.ok(codeVars.size > 0)
  assert.deepEqual([...codeVars].filter(name => !composeVars.has(name)), [])
})

test('the bot container gets no env var the code does not read', () => {
  assert.ok(composeVars.size > 0)
  assert.deepEqual([...composeVars].filter(name => !codeVars.has(name) && !RUNTIME_VARS.includes(name)), [])
})

test('every bot env var taken from .env is documented in .env.example', () => {
  const fromEnv = composeEntries.filter(({ value }) => value.includes('${')).map(({ name }) => name)
  assert.deepEqual(fromEnv.filter(name => !exampleVars.has(name)), [])
})

test('only the config module reads the environment', () => {
  assert.deepEqual(sourcesOutsideConfig.filter(file => readFileSync(join('src', file), 'utf8').includes('process.env')), [])
})
