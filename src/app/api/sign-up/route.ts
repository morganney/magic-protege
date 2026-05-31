import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  createAuthenticatedUserResponse,
  parseRouteJsonBody,
} from '@/app/api/auth-route-helpers'
import { normalizeEmail, normalizeOptionalText } from '@/auth/normalize'
import { hashPassword } from '@/auth/password'
import { db, schema } from '@/db/client'
import { generateId } from '@/db/id'

const signUpBodySchema = z.object({
  email: z.string().trim().max(320).pipe(z.email()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(120).optional(),
})

export async function POST(request: Request) {
  const parsedBody = await parseRouteJsonBody(
    request,
    signUpBodySchema,
    'Invalid signup payload.',
  )

  if (!parsedBody.success) {
    return parsedBody.response
  }

  const normalizedEmail = normalizeEmail(parsedBody.data.email)
  const normalizedDisplayName = normalizeOptionalText(parsedBody.data.displayName)
  const now = new Date()
  const passwordHash = await hashPassword(parsedBody.data.password)

  const insertedUsers = await db
    .insert(schema.usr)
    .values({
      id: generateId(),
      email: normalizedEmail,
      displayName: normalizedDisplayName,
      passwordHash,
      lastLoginAt: now,
      passwordUpdatedAt: now,
    })
    .onConflictDoNothing({ target: schema.usr.email })
    .returning({
      id: schema.usr.id,
      email: schema.usr.email,
      displayName: schema.usr.displayName,
    })

  const insertedUser = insertedUsers[0]

  if (!insertedUser) {
    return NextResponse.json({ error: 'Email already in use.' }, { status: 409 })
  }

  return createAuthenticatedUserResponse(
    {
      id: insertedUser.id,
      email: insertedUser.email,
      displayName: insertedUser.displayName,
    },
    201,
  )
}
