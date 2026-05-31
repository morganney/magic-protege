Build authentication in small, verifiable slices so each step teaches one concept at a time: data model, password security, sessions, cookies, route protection, and UX integration.

### Goal

Implement email/password login with Redis-backed server sessions and secure cookie transport, while validating each layer before adding the next one.

## Plan Provenance

Original plan source in memory:

1. /memories/session/plan.md

Related exploration notes in memory:

1. /memories/session/magic-protege-auth-exploration.md

## Current Status

1. Schema, migration, and seed updates for auth-compatible users are in place.
2. Password hashing utilities, Redis session helpers, and cookie helpers are implemented.
3. Sign-up endpoint is implemented with integration coverage in src/app/api/sign-up/route.test.ts.
4. Integration CI orchestration lives in .github/workflows/integration-tests.yml.
5. Login endpoint is implemented with integration coverage in src/app/api/login/route.test.ts.
6. Next implementation target is logout/session introspection (see Step 2 below).

## Remaining Steps (Renumbered)

### Step 1: Login endpoint

Completed.

### Step 2: Logout and session introspection

1. Add logout API route to revoke session and clear cookie.
2. Add lightweight current-session endpoint for client bootstrap.
3. Verify idempotent logout and expired-session behavior.

### Step 3: Route protection middleware

1. Add root middleware for public/protected route gating following docs contract.
2. Implement safe next handling and authenticated redirects away from login/sign-up.
3. Verify deep-link redirects and open-redirect protections.

### Step 4: Backend guard enforcement

1. Add server-side auth checks in protected API handlers and server code paths.
2. Keep middleware as UX gate only; backend checks remain authoritative.
3. Verify protected APIs reject requests without valid session even if middleware is bypassed.

### Step 5: UI wiring and docs

1. Build login/sign-up pages and connect them to new endpoints.
2. Add minimal authenticated UX affordances, including logout.
3. Update docs and environment notes.
4. Run end-to-end verification for the auth flows.

## Relevant Files

- src/db/schema.ts
- src/db/seed.ts
- src/auth/password.ts
- src/auth/session.ts
- src/auth/cookies.ts
- src/app/api/sign-up/route.ts
- src/app/api/sign-up/route.test.ts
- src/app/api (login/logout/session routes pending)
- src/app/api/chat/route.ts
- docs/middleware.md
- docs/routing.md
- compose.yml
- compose.test.yml
- .env.test
- .github/workflows/integration-tests.yml

## Verification Cadence

1. After each step: npm run check-types
2. After code-shape steps: npm run lint
3. After schema changes: npm run db:generate and npm run db:migrate
4. After auth behavior changes: run integration workflow commands locally against test infra

## Decisions Captured

- Hashing: bcrypt
- Session store: Redis
- Session policy: one active session per user
- TTL: 7 days with sliding refresh
- Cookie: mp_session, httpOnly, SameSite=Lax, secure in production
- Login credential checks: always run bcrypt compare using a fixed dummy hash fallback when stored password hash is missing
- Protection model: middleware plus backend checks
- Scope includes sign-up
- CSRF hardening deferred to a follow-up iteration
