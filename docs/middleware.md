# Middleware Architecture

## Purpose

Protect all authenticated app routes while preserving deep links and avoiding redirect loops.

## Public Routes

These routes are always accessible without authentication:

1. `/`
2. `/login`
3. `/sign-up`

## Protected Routes

All other application routes are protected, including:

1. `/draw`
2. `/draw/[slug]`
3. `/drawing/[id]`
4. `/drawings`
5. `/chats`

## Redirect Contract

If request is unauthenticated and route is protected:

1. Redirect to `/login?next=<encoded-path-and-query>`
2. Preserve original path and search params in `next`
3. Never include full external URL in `next`

If request is authenticated and route is `/login` or `/sign-up`:

1. Redirect to app default (for example `/drawings`)

## Security Rules

1. Middleware is a UX gate, not the only security boundary.
2. Enforce auth again in server components, route handlers, server actions, and DB access.
3. Validate `next` as an internal path before redirecting after login.
4. Reject any `next` value that starts with a protocol (`http://`, `https://`) or `//`.

## Matcher Scope

Apply middleware to app routes, excluding static and Next internals.

Recommended exclusions:

1. `/_next/static`
2. `/_next/image`
3. `/favicon.ico`
4. Public asset files (images, fonts, etc.)
5. Any public API auth endpoints that must remain unauthenticated

## Decision Flow

1. Parse request path.
2. Skip middleware logic for excluded static/internal paths.
3. Resolve auth session from cookie/token.
4. If unauthenticated and path is protected:
   1. Build safe `next` from pathname + search.
   2. Redirect to `/login?next=...`.
5. If authenticated and path is `/login` or `/sign-up`:
   1. Redirect to default authenticated landing route.
6. Otherwise allow request.

## Safe Next Handling

When reading `next` after login:

1. Accept only values that start with `/`.
2. Reject values starting with `//`.
3. Reject values containing scheme prefixes (`http:`, `https:`).
4. Fallback to `/drawings` when invalid.

## Pseudocode

```ts
function isPublicPath(pathname: string) {
  return pathname === '/' || pathname === '/login' || pathname === '/sign-up'
}

function isExcludedPath(pathname: string) {
  return (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/assets/')
  )
}

function buildSafeNext(pathname: string, search: string) {
  return `${pathname}${search || ''}`
}

function isSafeNext(next: string | null) {
  if (!next) return false
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false
  if (next.startsWith('/http:') || next.startsWith('/https:')) return false
  if (next.includes('://')) return false
  return true
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isExcludedPath(pathname)) {
    return NextResponse.next()
  }

  const session = getSessionFromRequest(request)
  const isAuthed = Boolean(session)

  if (!isAuthed && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set(
      'next',
      buildSafeNext(request.nextUrl.pathname, request.nextUrl.search),
    )
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthed && (pathname === '/login' || pathname === '/sign-up')) {
    return NextResponse.redirect(new URL('/drawings', request.url))
  }

  return NextResponse.next()
}
```

## Notes for Current Routing Model

1. `/drawing/[id]` is canonical for saved drawings.
2. `/draw/[slug]` supports draft or unsaved chat-first sessions.
3. Middleware should not encode chat state in URL shape; state is resolved from DB.
4. Keep ownership checks in data queries even after middleware passes.
