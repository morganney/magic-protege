import type { NextRequest, NextResponse } from 'next/server'

const {
  NODE_ENV,
  SESSION_COOKIE_NAME: sessionCookieNameEnv,
  SESSION_COOKIE_SECURE: sessionCookieSecureEnv,
  SESSION_COOKIE_MAX_AGE_SECONDS: sessionCookieMaxAgeSecondsEnv,
} = process.env
const DEFAULT_SESSION_COOKIE_NAME = 'mp_session'
const DEFAULT_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

type SessionCookieOptions = {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
}

function parseBooleanEnv(value: string | undefined) {
  if (value === undefined) {
    return null
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return null
}

function parseCookieMaxAge(value: string | undefined) {
  if (!value) {
    return DEFAULT_SESSION_COOKIE_MAX_AGE_SECONDS
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('SESSION_COOKIE_MAX_AGE_SECONDS must be a positive integer')
  }

  return parsed
}

export const SESSION_COOKIE_NAME = sessionCookieNameEnv ?? DEFAULT_SESSION_COOKIE_NAME
export const SESSION_COOKIE_MAX_AGE_SECONDS = parseCookieMaxAge(
  sessionCookieMaxAgeSecondsEnv,
)

export function isSessionCookieSecure(
  nodeEnv: string = NODE_ENV ?? 'development',
  secureOverride: string | undefined = sessionCookieSecureEnv,
) {
  const parsedOverride = parseBooleanEnv(secureOverride)

  if (parsedOverride !== null) {
    return parsedOverride
  }

  return nodeEnv === 'production'
}

export function getSessionCookieOptions(
  nodeEnv?: string,
  secureOverride?: string,
): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: isSessionCookieSecure(nodeEnv, secureOverride),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  }
}

export function readSessionCookie(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null
}

export function setSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, getSessionCookieOptions())
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(),
    maxAge: 0,
  })
}

export type { SessionCookieOptions }
