import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('@types/node is on the Node major the Dockerfile runs', () => {
  const nodeMajor = /^ARG NODE_VERSION=(\d+)$/m.exec(readFileSync('Dockerfile', 'utf8'))?.[1]
  const { devDependencies } = JSON.parse(readFileSync('package.json', 'utf8')) as { devDependencies: Record<string, string> }
  const typesMajor = /\d+/.exec(devDependencies['@types/node'] ?? '')?.[0]
  assert.ok(nodeMajor, 'Dockerfile declares ARG NODE_VERSION=<major>')
  assert.equal(typesMajor, nodeMajor)
})
