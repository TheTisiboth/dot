import dotenv from 'dotenv'
import { loadConfig } from './env'

dotenv.config({ quiet: true })

// shortcut: global config loaded on import, until #65 moves loadConfig to the entry point
const load = () => {
  try {
    return loadConfig(process.env)
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}\n\nPlease check your .env file.`)
    process.exit(1)
  }
}

export const config = load()
