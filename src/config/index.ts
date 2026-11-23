import dotenv from 'dotenv'

/** The process environment, with `.env` filling the variables left unset. */
export function readEnv(): Record<string, string | undefined> {
  dotenv.config({ quiet: true })
  return process.env
}
