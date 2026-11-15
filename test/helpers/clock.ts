import { mock } from 'node:test'

export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS

/** Lets every pending promise chain run; setImmediate stays real under the mocked timers. */
export const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)) }

/** Fakes setTimeout and Date from `now`; pair with `mock.timers.reset()` after each test. */
export const startAt = (now: Date) => { mock.timers.enable({ apis: ['setTimeout', 'Date'], now }) }

/** node-cron counts a beat landing past its slot as missed: tick onto a cron slot exactly, not past it. */
export const advance = async (ms: number) => { mock.timers.tick(ms); await settle() }
