import bcrypt from 'bcrypt'

const DEFAULT_BCRYPT_COST = 12
/*
 * Fallback bcrypt hash used when a user has no stored password hash.
 * This ensures verifyPassword still performs comparable bcrypt work
 * to reduce account-state timing differences during login.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$iE3OrfJ1XbnArwCgvz1AFuM.XGYLwAr6SVm6fqS3SM1HRNAVF46Q6'

function getComparablePasswordHash(passwordHash: string | null) {
  return passwordHash ?? DUMMY_PASSWORD_HASH
}

function getBcryptCost() {
  const value = process.env.BCRYPT_COST
  if (!value) {
    return DEFAULT_BCRYPT_COST
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 31) {
    throw new Error('BCRYPT_COST must be an integer between 4 and 31')
  }

  return parsed
}

export async function hashPassword(password: string) {
  if (!password) {
    throw new Error('Password must not be empty')
  }

  const cost = getBcryptCost()
  return bcrypt.hash(password, cost)
}

export async function verifyPassword(password: string, passwordHash: string | null) {
  return bcrypt.compare(password, getComparablePasswordHash(passwordHash))
}
