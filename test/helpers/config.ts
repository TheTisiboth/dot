import { afterEach } from 'node:test'
import { config } from '../../src/config'

const original = structuredClone(config)

/** Tests tweak the loaded config in place; each one starts from the testEnv values again. */
export const restoreConfigAfterEach = () => {
  afterEach(() => { Object.assign(config, structuredClone(original)) })
}
