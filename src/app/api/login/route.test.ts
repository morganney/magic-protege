import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearAuthIntegrationDatabaseState,
  clearAuthIntegrationSessionState,
} from '@/app/api/test-utils/auth-test-state'
import { POST as postLogin } from '@/app/api/login/route'
import { hashPassword } from '@/auth/password'
import {
  closeSessionStoreConnection,
  getSessionById,
  replaceSessionForUser,
} from '@/auth/session'
import { generateId } from '@/db/id'
import { sql } from '@/db/client'
import type { Usr } from '@/db/schema'

beforeEach(async () => {
  await clearAuthIntegrationDatabaseState(sql)
  await clearAuthIntegrationSessionState()
})

describe('POST /api/login', () => {
  it('returns 400 when request body is invalid JSON', async () => {
    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{',
    })

    const response = await postLogin(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Invalid request body.' })
  })

  it('returns 400 for invalid login payload', async () => {
    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'short',
      }),
    })

    const response = await postLogin(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Invalid login payload.' })
  })

  it('returns 401 when user does not exist', async () => {
    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'missing@example.com',
        password: 'test-password-123',
      }),
    })

    const response = await postLogin(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Invalid credentials.' })
  })

  it('returns 401 when password is incorrect', async () => {
    const userId = generateId()
    const now = new Date().toISOString()
    const passwordHash = await hashPassword('correct-password-123')

    await sql`
      insert into "usr" (id, email, display_name, password_hash, last_login_at, password_updated_at, created_at, updated_at)
      values (${userId}, ${'test@example.com'}, ${'Test User'}, ${passwordHash}, ${now}, ${now}, ${now}, ${now})
    `

    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrong-password-123',
      }),
    })

    const response = await postLogin(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Invalid credentials.' })
  })

  it('returns 401 when user has no password hash', async () => {
    const userId = generateId()
    const now = new Date().toISOString()

    await sql`
      insert into "usr" (id, email, display_name, password_hash, last_login_at, password_updated_at, created_at, updated_at)
      values (${userId}, ${'oauth-only@example.com'}, ${'OAuth User'}, ${null}, ${now}, ${null}, ${now}, ${now})
    `

    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'oauth-only@example.com',
        password: 'test-password-123',
      }),
    })

    const response = await postLogin(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Invalid credentials.' })
  })

  it('logs in, rotates existing session, and sets auth cookie', async () => {
    const userId = generateId()
    const priorLastLoginAt = '2020-01-01T00:00:00.000Z'
    const now = new Date().toISOString()
    const passwordHash = await hashPassword('correct-password-123')

    await sql`
      insert into "usr" (id, email, display_name, password_hash, last_login_at, password_updated_at, created_at, updated_at)
      values (${userId}, ${'testuser@example.com'}, ${'Test User'}, ${passwordHash}, ${priorLastLoginAt}, ${now}, ${now}, ${now})
    `

    const priorSession = await replaceSessionForUser(userId)
    const priorSessionBeforeLogin = await getSessionById(priorSession.sessionId)

    expect(priorSessionBeforeLogin?.userId).toBe(userId)

    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'TestUser@Example.com',
        password: 'correct-password-123',
      }),
    })

    const response = await postLogin(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.user).toEqual({
      id: userId,
      email: 'testuser@example.com',
      displayName: 'Test User',
    })

    const setCookieHeader = response.headers.get('set-cookie')

    expect(setCookieHeader).toBeTruthy()
    expect(setCookieHeader).toContain('mp_session=')
    expect(setCookieHeader).toContain('HttpOnly')
    expect(setCookieHeader).toContain('SameSite=lax')

    const cookieToken = setCookieHeader?.split(';')[0].split('=').slice(1).join('=')

    expect(cookieToken).toBeTruthy()

    const nextSession = await getSessionById(cookieToken ?? '')

    expect(nextSession?.userId).toBe(userId)

    const priorSessionAfterLogin = await getSessionById(priorSession.sessionId)

    expect(priorSessionAfterLogin).toBeNull()

    const [updatedUser] = await sql<Pick<Usr, 'lastLoginAt'>[]>`
      select last_login_at as "lastLoginAt"
      from "usr"
      where id = ${userId}
    `

    expect(updatedUser.lastLoginAt).toBeTruthy()
    expect(new Date(updatedUser.lastLoginAt ?? 0).getTime()).toBeGreaterThan(
      Date.parse(priorLastLoginAt),
    )

    await closeSessionStoreConnection()
  })
})
