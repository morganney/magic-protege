import { randomUUID } from 'node:crypto'

import {
  closeSessionStoreConnection,
  getSessionById,
  replaceSessionForUser,
  revokeSession,
} from '../../src/auth/session.js'

const userId = randomUUID()

try {
  const first = await replaceSessionForUser(userId)
  const firstLookup = await getSessionById(first.sessionId)

  if (!firstLookup || firstLookup.userId !== userId) {
    throw new Error('Expected first session lookup to resolve for user')
  }

  const second = await replaceSessionForUser(userId)
  const invalidatedFirst = await getSessionById(first.sessionId)
  if (invalidatedFirst) {
    throw new Error('Expected previous session to be invalidated after replacement')
  }

  const secondLookup = await getSessionById(second.sessionId)
  if (!secondLookup || secondLookup.userId !== userId) {
    throw new Error('Expected replacement session lookup to resolve for user')
  }

  await revokeSession(second.sessionId)
  const revokedLookup = await getSessionById(second.sessionId)
  if (revokedLookup) {
    throw new Error('Expected revoked session to be unavailable')
  }

  console.log('Session utility check passed.')
} finally {
  await closeSessionStoreConnection()
}
