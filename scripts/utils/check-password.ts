import { hashPassword, verifyPassword } from '../../src/auth/password.js'

const samplePassword = 'local-dev-password'
const wrongPassword = 'not-the-right-password'

const hash = await hashPassword(samplePassword)
const valid = await verifyPassword(samplePassword, hash)
const invalid = await verifyPassword(wrongPassword, hash)

if (!valid) {
  throw new Error('Expected password verification to succeed')
}

if (invalid) {
  throw new Error('Expected wrong password verification to fail')
}

console.log('Password utility check passed.')
