import { NextResponse } from 'next/server'
import { z } from 'zod'

import { setSessionCookie } from '@/auth/cookies'
import { hashPassword } from '@/auth/password'
import { replaceSessionForUser } from '@/auth/session'
import { db, schema } from '@/db/client'
import { generateId } from '@/db/id'

const signUpBodySchema = z.object({
  email: z.email().trim().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(120).optional(),
})

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeDisplayName(value: string | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsedBody = signUpBodySchema.safeParse(body)

  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid signup payload.' }, { status: 400 })
  }

  const normalizedEmail = normalizeEmail(parsedBody.data.email)
  const normalizedDisplayName = normalizeDisplayName(parsedBody.data.displayName)
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

  const session = await replaceSessionForUser(insertedUser.id)
  const response = NextResponse.json(
    {
      user: {
        id: insertedUser.id,
        email: insertedUser.email,
        displayName: insertedUser.displayName,
      },
    },
    { status: 201 },
  )

  setSessionCookie(response, session.sessionId)

  return response
}
