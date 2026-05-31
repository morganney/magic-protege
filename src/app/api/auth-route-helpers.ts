import { NextResponse } from 'next/server'
import type { z } from 'zod'

import { setSessionCookie } from '@/auth/cookies'
import { replaceSessionForUser } from '@/auth/session'

type AuthResponseUser = {
  id: string
  email: string
  displayName: string | null
}
type ParsedRouteBodySuccess<TSchema extends z.ZodTypeAny> = {
  success: true
  data: z.infer<TSchema>
}
type ParsedRouteBodyFailure = {
  success: false
  response: NextResponse<{ error: string }>
}
type ParsedRouteBody<TSchema extends z.ZodTypeAny> =
  | ParsedRouteBodySuccess<TSchema>
  | ParsedRouteBodyFailure

export async function parseRouteJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
  invalidPayloadMessage: string,
): Promise<ParsedRouteBody<TSchema>> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }),
    }
  }

  const parsedBody = schema.safeParse(body)

  if (!parsedBody.success) {
    return {
      success: false,
      response: NextResponse.json({ error: invalidPayloadMessage }, { status: 400 }),
    }
  }

  return {
    success: true,
    data: parsedBody.data,
  }
}

export async function createAuthenticatedUserResponse(
  user: AuthResponseUser,
  status: number,
) {
  const session = await replaceSessionForUser(user.id)
  const response = NextResponse.json(
    {
      user,
    },
    { status },
  )

  setSessionCookie(response, session.sessionId)

  return response
}

export type { AuthResponseUser }
