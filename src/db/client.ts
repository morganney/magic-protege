import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema.js'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const host = process.env.POSTGRES_HOST ?? 'localhost'
const port = Number(process.env.POSTGRES_PORT ?? '5432')
const user = requiredEnv('POSTGRES_USER')
const password = requiredEnv('POSTGRES_PASSWORD')
const database = requiredEnv('POSTGRES_DB')

export const sql = postgres({
  host,
  port,
  user,
  password,
  database,
})

export const db = drizzle(sql, { schema })

export { schema }
