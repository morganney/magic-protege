import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearAuthIntegrationDatabaseState,
  clearAuthIntegrationSessionState,
} from '@/app/api/test-utils/auth-test-state'
import { POST as postSignUp } from '@/app/api/sign-up/route'
import { closeSessionStoreConnection, getSessionById } from '@/auth/session'
import { generateId } from '@/db/id'
import { sql } from '@/db/client'
import type { Usr } from '@/db/schema'

beforeEach(async () => {
  await clearAuthIntegrationDatabaseState(sql)
  await clearAuthIntegrationSessionState()
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
    const existingId = generateId()
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
