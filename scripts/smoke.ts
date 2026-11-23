import { execFileSync } from 'node:child_process'

// Plain node, not tsx: tsx would resolve the extensionless imports a broken tsc-alias leaves in dist/.
// app.js, not main.js: it loads every module, while main.js starts the bot
execFileSync('node', ['--input-type=module', '-e', "await import('./dist/app.js')"], { stdio: 'inherit' })
