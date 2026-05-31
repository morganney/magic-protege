import { createClient, type RedisClientType } from 'redis'
import { z } from 'zod'

import { generateId } from '@/db/id'

const {
  REDIS_URL,
  REDIS_HOST,
  REDIS_PORT,
  SESSION_KEY_PREFIX: sessionKeyPrefixEnv,
} = process.env
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const SESSION_KEY_PREFIX = sessionKeyPrefixEnv ?? 'mp:session:v1'
const SessionRecordSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
})

type SessionRecord = z.infer<typeof SessionRecordSchema>

let redisClient: RedisClientType | null = null
let connectPromise: Promise<RedisClientType> | null = null

function getRedisUrl() {
  if (REDIS_URL) {
    return REDIS_URL
  }

  const host = REDIS_HOST ?? '127.0.0.1'
  const port = REDIS_PORT ?? '6379'

  return `redis://${host}:${port}`
}

function getSessionKey(sessionId: string) {
  return `${SESSION_KEY_PREFIX}:id:${sessionId}`
}

function getUserSessionKey(userId: string) {
  return `${SESSION_KEY_PREFIX}:user:${userId}`
}

function nowIso() {
  return new Date().toISOString()
}

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: getRedisUrl(),
    })

    redisClient.on('error', error => {
      console.error('Redis session store error:', error)
    })
  }

  if (!redisClient.isOpen) {
    if (!connectPromise) {
      /**
       * Use a shared in-flight connect promise as a lock so concurrent callers
       * wait on one connection attempt instead of racing multiple connect() calls.
       */
      connectPromise = redisClient.connect().finally(() => {
        connectPromise = null
      })
    }

    await connectPromise
  }

  return redisClient
}

function parseSessionRecord(value: string | null): SessionRecord | null {
  if (!value) {
    return null
  }

  try {
    const parsed = SessionRecordSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function replaceSessionForUser(userId: string) {
  const client = await getRedisClient()
  const sessionId = generateId()
  const now = nowIso()
  const nextSession: SessionRecord = {
    sessionId,
    userId,
    createdAt: now,
    lastSeenAt: now,
  }

  await client.set(getSessionKey(sessionId), JSON.stringify(nextSession), {
    EX: SESSION_TTL_SECONDS,
  })

  /**
   * Atomically replace user->session mapping and capture the prior session id.
   * This prevents races from leaving multiple active sessions for one user.
   */
  const priorSessionId = await client.set(getUserSessionKey(userId), sessionId, {
    EX: SESSION_TTL_SECONDS,
    GET: true,
  })

  if (priorSessionId && priorSessionId !== nextSession.sessionId) {
    await client.del(getSessionKey(priorSessionId))
  }

  return nextSession
}

export async function getSessionById(sessionId: string) {
  const client = await getRedisClient()
  const value = await client.get(getSessionKey(sessionId))
  const session = parseSessionRecord(value)

  if (!session) {
    return null
  }

  const refreshedSession: SessionRecord = {
    ...session,
    lastSeenAt: nowIso(),
  }

  await client
    .multi()
    .set(getSessionKey(session.sessionId), JSON.stringify(refreshedSession), {
      EX: SESSION_TTL_SECONDS,
    })
    .expire(getUserSessionKey(session.userId), SESSION_TTL_SECONDS)
    .exec()

  return refreshedSession
}

export async function revokeSession(sessionId: string) {
  const client = await getRedisClient()
  const value = await client.get(getSessionKey(sessionId))
  const session = parseSessionRecord(value)

  await client.del(getSessionKey(sessionId))

  if (!session) {
    return
  }

  const mappedSessionId = await client.get(getUserSessionKey(session.userId))

  if (mappedSessionId === sessionId) {
    await client.del(getUserSessionKey(session.userId))
  }
}

export async function closeSessionStoreConnection() {
  if (!redisClient || !redisClient.isOpen) {
    return
  }

  await redisClient.quit()
}

export type { SessionRecord }
