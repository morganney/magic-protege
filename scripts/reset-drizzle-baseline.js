import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const drizzleDir = resolve(repoRoot, 'drizzle')

await rm(drizzleDir, { recursive: true, force: true })
await mkdir(drizzleDir, { recursive: true })

console.log('Reset drizzle migration artifacts.')
console.log('Next steps:')
console.log('1) npm run db:generate')
console.log('2) docker compose down -v && docker compose up -d db')
console.log('3) npm run db:migrate')
