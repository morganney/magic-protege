import { defineConfig } from 'drizzle-kit'
import { loadEnvFile } from 'node:process'

const envFile = process.env.ENV_FILE ?? '.env'

loadEnvFile(envFile)

const port = Number(process.env.POSTGRES_PORT ?? '5432')

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port,
    user: process.env.POSTGRES_USER ?? '',
    password: process.env.POSTGRES_PASSWORD ?? '',
    database: process.env.POSTGRES_DB ?? '',
    ssl: false,
  },
  verbose: true,
  strict: true,
})
