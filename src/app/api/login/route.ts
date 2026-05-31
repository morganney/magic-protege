import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  createAuthenticatedUserResponse,
  parseRouteJsonBody,
} from '@/app/api/auth-route-helpers'
import { normalizeEmail } from '@/auth/normalize'
import { verifyPassword } from '@/auth/password'
import { db, schema } from '@/db/client'

const loginBodySchema = z.object({
  email: z.string().trim().max(320).pipe(z.email()),
  password: z.string().min(8).max(128),
})

export async function POST(request: Request) {
  const parsedBody = await parseRouteJsonBody(
    request,
    loginBodySchema,
    'Invalid login payload.',
  )

  if (!parsedBody.success) {
    return parsedBody.response
  }

  const normalizedEmail = normalizeEmail(parsedBody.data.email)
  const users = await db
    .select({
      id: schema.usr.id,
      email: schema.usr.email,
      displayName: schema.usr.displayName,
      passwordHash: schema.usr.passwordHash,
    })
    .from(schema.usr)
    .where(eq(schema.usr.email, normalizedEmail))
    .limit(1)

  const user = users[0]
  const isValidPassword = await verifyPassword(
    parsedBody.data.password,
    user?.passwordHash ?? null,
  )

  if (!user || !isValidPassword) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 })
  }

  await db
    .update(schema.usr)
    .set({
      lastLoginAt: new Date(),
    })
    .where(eq(schema.usr.id, user.id))

  return createAuthenticatedUserResponse(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    200,
  )
}
