Build authentication in small, verifiable slices so each step teaches one concept at a time: data model, password security, sessions, cookies, route protection, and UX integration.

### Goal

Implement email/password login with Redis-backed server sessions and secure cookie transport, while learning each layer before adding the next one.

### Step 1: Data model only

1. Add credential storage fields to the user schema, including password hash and optional auth metadata.
2. Generate and apply migration.
3. Update seed strategy so local users can eventually authenticate.
4. Verify DB shape and seeded data before moving forward.

### Step 2: Password utilities in isolation

1. Add bcrypt dependency.
2. Implement hash and verify helpers in a dedicated auth utility.
3. Add a focused check or tiny script to prove hash/verify behavior.
4. Verify cost factor and failure behavior.

### Step 3: Redis session foundation

1. Add Redis client dependency and environment configuration.
2. Implement session helpers: create, lookup, revoke, replace-per-user.
3. Implement 7-day TTL with sliding refresh on successful lookups.
4. Verify keys and TTL behavior manually in Redis.

### Step 4: Cookie contract helpers

1. Implement cookie read, set, and clear helpers using mp_session.
2. Enforce httpOnly, sameSite=Lax, path=/, secure in production.
3. Verify Set-Cookie behavior in local development and production mode assumptions.

### Step 5: Signup endpoint

1. Add sign-up API route with input validation, unique email checks, password hashing, and user creation.
2. Create session in Redis and set cookie on successful signup.
3. Verify signup end-to-end and immediate authenticated state.

### Step 6: Login endpoint

1. Add login API route with email/password validation and credential verification.
2. Replace prior active session for that user and issue a fresh cookie.
3. Verify success, wrong password, and unknown user cases.

### Step 7: Logout and session introspection

1. Add logout API route to revoke session and clear cookie.
2. Add lightweight current-session endpoint for client bootstrap.
3. Verify idempotent logout and expired-session behavior.

### Step 8: Route protection middleware

1. Add root middleware for public/protected route gating following your docs contract.
2. Implement safe next handling and authenticated redirects away from login and sign-up.
3. Verify deep-link redirects and open-redirect protections.

### Step 9: Backend guard enforcement

1. Add server-side auth checks in protected API handlers and server code paths.
2. Keep middleware as UX gate only; backend checks stay authoritative.
3. Verify protected APIs reject requests without valid session even if middleware is bypassed.

### Step 10: UI wiring and docs

1. Build login/sign-up pages and connect them to new endpoints.
2. Add minimal authenticated UX affordances, such as logout action.
3. Update docs and environment setup notes.
4. Run final end-to-end verification of all auth flows.

## Recommended Order Rationale

Start with foundations that other layers depend on, then state handling, then behavior surfaces, then enforcement, then UX polish.

1. Schema and migration first
2. Password hashing second
3. Redis sessions third
4. Cookie policy fourth
5. Signup/login/logout endpoints next
6. Middleware and backend guard enforcement after that
7. UI and docs last

## Relevant Files

- magic-protege/src/db/schema.ts — add credential columns
- magic-protege/src/db/seed.ts — seed auth-compatible users
- magic-protege/package.json — add bcrypt and Redis dependencies
- magic-protege/src/app/api — add sign-up, login, logout, session endpoints
- magic-protege/src/app/api/chat/route.ts — apply backend auth guard usage
- magic-protege/docs/middleware.md — keep implementation aligned with contract
- magic-protege/docs/routing.md — keep route/auth flow docs aligned
- magic-protege/compose.yml — Redis service contract
- magic-protege/src/app — add login/sign-up pages if missing
- magic-protege/src/app/proxy.ts — evaluate replacement by root middleware

## Verification Cadence

1. After each step: run npm run check-types
2. After code-shape steps: run npm run lint
3. After schema changes: run npm run db:generate and npm run db:migrate
4. After seed changes: run npm run db:seed
5. After auth behavior changes: manually verify success and failure paths before proceeding

## Decisions Captured

- Hashing: bcrypt
- Session store: Redis
- Session policy: one active session per user
- TTL: 7 days, sliding refresh
- Cookie: mp_session, httpOnly, SameSite=Lax, secure in production
- Protection model: middleware and backend checks
- Scope includes sign-up
- CSRF hardening deferred to a follow-up iteration

If you want, next message I can format this exactly as docs-ready content for magic-protege/docs/auth-implementation-plan.md with a short front-matter style header.
