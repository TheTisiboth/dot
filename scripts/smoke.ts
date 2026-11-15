import '../test/helpers/testEnv'
import { execFileSync } from 'node:child_process'

// Plain node, not tsx: tsx would resolve the extensionless imports a broken tsc-alias leaves in dist/
execFileSync('node', ['--input-type=module', '-e', "await import('./dist/app.js')"], { stdio: 'inherit' })
