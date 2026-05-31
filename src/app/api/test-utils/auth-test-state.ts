import { loadEnvFile } from 'node:process'

import { createClient } from 'redis'

type SqlClient = typeof import('@/db/client').sql

const envFile = process.env.ENV_FILE ?? '.env'

loadEnvFile(envFile)

const {
  SESSION_KEY_PREFIX: sessionKeyPrefixEnv,
  REDIS_URL,
  REDIS_HOST,
  REDIS_PORT,
} = process.env

const sessionKeyPrefix = sessionKeyPrefixEnv ?? 'mp:session:v1'

export async function clearAuthIntegrationDatabaseState(sql: SqlClient) {
  await sql`
    truncate table
      "chat_message",
      "chat",
      "drawing",
      "usr"
    restart identity
    cascade
  `
}

export async function clearAuthIntegrationSessionState() {
  const redisUrl =
    REDIS_URL ?? `redis://${REDIS_HOST ?? '127.0.0.1'}:${REDIS_PORT ?? '6379'}`
  const client = createClient({ url: redisUrl })

  await client.connect()

  try {
    let cursor = '0'
    do {
      const result = await client.scan(cursor, {
        MATCH: `${sessionKeyPrefix}:*`,
        COUNT: 100,
      })
      cursor = result.cursor

      if (result.keys.length > 0) {
        await client.del(result.keys)
      }
    } while (cursor !== '0')
  } finally {
    await client.quit()
  }
}
