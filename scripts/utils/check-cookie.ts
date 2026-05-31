import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  isSessionCookieSecure,
} from '../../src/auth/cookies.js'

const devSecure = isSessionCookieSecure('development')
const prodSecure = isSessionCookieSecure('production')
const forcedSecure = isSessionCookieSecure('development', 'true')
const forcedInsecure = isSessionCookieSecure('production', 'false')

if (devSecure) {
  throw new Error('Expected development cookie secure=false by default')
}

if (!prodSecure) {
  throw new Error('Expected production cookie secure=true by default')
}

if (!forcedSecure) {
  throw new Error('Expected secure override true to force secure cookies')
}

if (forcedInsecure) {
  throw new Error('Expected secure override false to disable secure cookies')
}

const options = getSessionCookieOptions('development')
if (!options.httpOnly) {
  throw new Error('Expected session cookie to be httpOnly')
}

if (options.sameSite !== 'lax') {
  throw new Error('Expected session cookie sameSite=lax')
}

if (options.path !== '/') {
  throw new Error('Expected session cookie path=/')
}

if (options.maxAge !== SESSION_COOKIE_MAX_AGE_SECONDS) {
  throw new Error('Expected session cookie maxAge to match configured value')
}

if (!SESSION_COOKIE_NAME) {
  throw new Error('Expected session cookie name to be configured')
}

console.log('Cookie utility check passed.')
