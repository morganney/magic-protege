import { loadEnvFile } from 'node:process'

import { createClient } from 'redis'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Usr } from '@/db/schema'

const { ENV_FILE } = process.env
const envFile = ENV_FILE ?? '.env'

loadEnvFile(envFile)

const {
  SESSION_KEY_PREFIX: sessionKeyPrefixEnv,
  REDIS_URL,
  REDIS_HOST,
  REDIS_PORT,
} = process.env

type SignUpPost = typeof import('@/app/api/sign-up/route').POST

let postSignUp: SignUpPost
let sql: typeof import('@/db/client').sql
let closeSessionStoreConnection: typeof import('@/auth/session').closeSessionStoreConnection
let getSessionById: typeof import('@/auth/session').getSessionById

const sessionKeyPrefix = sessionKeyPrefixEnv ?? 'mp:session:v1'

async function clearDatabaseState() {
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

async function clearSessionState() {
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

beforeAll(async () => {
  const routeModule = await import('@/app/api/sign-up/route')
  const dbClientModule = await import('@/db/client')
  const sessionModule = await import('@/auth/session')

  postSignUp = routeModule.POST
  sql = dbClientModule.sql
  closeSessionStoreConnection = sessionModule.closeSessionStoreConnection
  getSessionById = sessionModule.getSessionById
})

beforeEach(async () => {
  await clearDatabaseState()
  await clearSessionState()
})

describe('POST /api/sign-up', () => {
  it('returns 400 when request body is invalid JSON', async () => {
    const request = new Request('http://localhost/api/sign-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{',
    })
    const response = await postSignUp(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Invalid request body.' })
  })

  it('returns 400 for invalid signup payload', async () => {
    const request = new Request('http://localhost/api/sign-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'short',
      }),
    })

    const response = await postSignUp(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Invalid signup payload.' })
  })

  it('creates a user and sets an auth session cookie', async () => {
    const request = new Request('http://localhost/api/sign-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'TestUser@Example.com',
        password: 'test-password-123',
        displayName: '  Test User  ',
      }),
    })

    const response = await postSignUp(request)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.user).toMatchObject({
      email: 'testuser@example.com',
      displayName: 'Test User',
    })

    const [insertedUser] = await sql<
      Pick<Usr, 'email' | 'displayName' | 'passwordHash'>[]
    >`
      select email, display_name as "displayName", password_hash as "passwordHash"
      from "usr"
      where id = ${payload.user.id}
    `

    expect(insertedUser).toBeDefined()
    expect(insertedUser.email).toBe('testuser@example.com')
    expect(insertedUser.displayName).toBe('Test User')
    expect(typeof insertedUser.passwordHash).toBe('string')
    expect(insertedUser.passwordHash).not.toBe('test-password-123')

    const setCookieHeader = response.headers.get('set-cookie')

    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader).toContain('mp_session=')
    expect(setCookieHeader).toContain('HttpOnly')
    expect(setCookieHeader).toContain('SameSite=lax')

    const cookieToken = setCookieHeader?.split(';')[0].split('=').slice(1).join('=')

    expect(cookieToken).toBeTruthy()

    const session = await getSessionById(cookieToken ?? '')

    expect(session?.userId).toBe(payload.user.id)

    await closeSessionStoreConnection()
  })

  it('returns 409 when email already exists', async () => {
    const existingId = crypto.randomUUID()
    const now = new Date().toISOString()

    await sql`
      insert into "usr" (id, email, display_name, password_hash, last_login_at, password_updated_at, created_at, updated_at)
      values (${existingId}, ${'already@exists.com'}, ${'Existing User'}, ${'$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}, ${now}, ${now}, ${now}, ${now})
    `

    const request = new Request('http://localhost/api/sign-up', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'already@exists.com',
        password: 'test-password-123',
      }),
    })
    const response = await postSignUp(request)
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({ error: 'Email already in use.' })
  })
})
