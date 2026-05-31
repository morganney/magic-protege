import bcrypt from 'bcrypt'

const DEFAULT_BCRYPT_COST = 12

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
  if (!passwordHash) {
    return false
  }

  return bcrypt.compare(password, passwordHash)
}
