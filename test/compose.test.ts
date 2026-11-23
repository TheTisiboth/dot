import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const services = (file: string): Map<string, string> => new Map(
  [...readFileSync(file, 'utf8').matchAll(/^ {2}([\w-]+):\n([\s\S]*?)(?=^ {0,2}\S|(?![\s\S]))/gm)].map(([, name, body]) => [name, body])
)

const base = services('docker-compose.yml')
const prod = services('docker-compose.prod.yml')

test('the Ollama API is published on loopback only, never on the LAN', () => {
  const ports = [...(base.get('ollama') ?? '').matchAll(/^\s+- "([^"]+)"$/gm)].map(([, port]) => port)
  assert.ok(ports.length > 0)
  assert.deepEqual(ports.filter(port => !port.startsWith('127.0.0.1:')), [])
})

test('the bot starts without waiting for Ollama to be healthy', () => {
  assert.match(base.get('frisbee-bot') ?? '', /depends_on:/)
  assert.doesNotMatch(base.get('frisbee-bot') ?? '', /service_healthy/)
})

test('in production only the bot joins the shared network, next to its own', () => {
  assert.deepEqual([...prod.keys()].filter(name => name !== 'dokploy-network'), ['frisbee-bot'])
  assert.match(prod.get('frisbee-bot') ?? '', /- default\n\s+- dokploy-network/)
})
