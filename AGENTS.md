---
name: magic-protege-agent
description: Baseline coding agent guidance for magic-protege (Next.js, AI SDK chat, magic-crayon canvas UI, and Drizzle/Postgres workflows).
---

You are a specialist engineer for the magic-protege project. Make focused, testable changes that preserve behavior and keep the project easy to iterate on.

## Commands

Repo root commands:

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Start production build: `npm run start`
- Typecheck: `npm run check-types`
- Lint: `npm run lint`
- Format write: `npm run prettier`
- Generate migrations: `npm run db:generate`
- Apply migrations: `npm run db:migrate`
- Seed (reset first): `npm run db:seed`
- Seed append-only: `npm run db:seed:append`
- Seed reset explicitly: `npm run db:seed:reset`

## Project knowledge

**Tech stack**

- Next.js App Router + React + TypeScript (strict)
- AI SDK chat integration with tool-call style canvas edits
- `magic-crayon` web component for drawing interactions
- Drizzle ORM + drizzle-kit + drizzle-seed
- Postgres (`postgres` npm package via `drizzle-orm/postgres-js`)

**Repository structure**

- `src/app/` - Next.js pages, layouts, API routes, UI components
- `src/db/` - schema, DB client, and seed scripts
- `drizzle/` - generated migration SQL and metadata
- `compose.yml` - local Postgres + Redis services

## Core priorities

1. Preserve drawing/chat user flows
   - Support chat-first and drawing-first flows without breaking data integrity.
   - Keep data relationships compatible with unsaved-to-saved transitions.

2. Keep DB changes safe and reversible
   - Every schema change must be migration-backed.
   - Verify migrations against local compose Postgres service.

3. Keep runtime integration consistent
   - Use `postgres-js` adapter patterns for Drizzle runtime access.
   - Keep ESM import style with explicit local file extensions.

4. Minimize blast radius
   - Avoid broad refactors when solving focused issues.
   - Maintain existing naming and coding conventions in touched files.

## Data and DB rules

- Prefer `timestamp(..., { withTimezone: true })` for persisted event times.
- Use JSONB for evolving AI/canvas payloads when schema rigidity is not required.
- Prefer explicit indexes/uniques for query paths and integrity constraints.
- When seeding repeatedly, use reset-first mode to avoid deterministic PK collisions.

## Coding conventions

- Keep TypeScript strict and avoid `any`.
- Favor small helpers and clear data-shape types.
- Use ESM imports with explicit local file extensions (for example `./schema.js`).
- Prefer native Node.js APIs over adding dependencies when native APIs are sufficient.
- Prefer TypeScript inference over explicit type annotations when the type is already clear from context.
- Never use IIFE patterns.
- Prefer `async`/`await` over `.then()` chains unless a specific case requires chaining.
- Use concise comments only where behavior is non-obvious.
- Do not use index files or barrel-file architecture; prefer explicit file names and explicit import paths.
- Prefer modular, colocated architecture; split focused features into nearby files and avoid monolithic modules.

## Validation expectations

After meaningful code edits, run:

1. `npm run check-types`
2. `npm run lint` (when applicable)
3. `npm run db:migrate` for schema/migration changes
4. `npm run db:seed` when validating realistic DB data scenarios

## Boundaries

**Always:**

- Keep changes scoped to the task.
- Verify DB and type correctness for schema/tooling work.
- Preserve public API contracts unless explicitly asked to change them.

**Ask first:**

- Adding/changing dependencies.
- Changing schema semantics that could invalidate existing data.
- Modifying CI/release or deployment workflows.

**Never:**

- Commit secrets or API keys.
- Edit generated outputs manually when the canonical source is code/config.
- Introduce breaking behavior without explicit approval.
