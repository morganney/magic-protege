# Routing Architecture

## Goals

1. Keep saved drawing URLs stable and bookmarkable.
2. Support chat-first and drawing-first creation flows.
3. Enforce authentication for all app routes except public entry/auth pages.
4. Preserve deep links through login redirects.
5. Enforce one chat thread per saved drawing.

## Route Map

```text
app/
├── page.tsx                     # / (marketing landing page)
├── login/
│   └── page.tsx                 # /login
├── sign-up/
│   └── page.tsx                 # /sign-up
├── draw/
│   ├── page.tsx                 # /draw (fresh scratchpad)
│   └── [slug]/
│       └── page.tsx             # /draw/[slug] (draft/unsaved session)
├── drawing/
│   └── [id]/
│       └── page.tsx             # /drawing/[id] (canonical saved drawing route)
├── drawings/
│   └── page.tsx                 # /drawings (saved drawings list)
└── chats/
	└── page.tsx                   # /chats (draft + historical chat list)
```

## Public vs Protected Routes

Public routes:

1. `/`
2. `/login`
3. `/sign-up`

Protected routes:

1. `/draw`
2. `/draw/[slug]`
3. `/drawing/[id]`
4. `/drawings`
5. `/chats`

All protected routes require middleware redirect to `/login` when unauthenticated.

## Auth Redirect Contract

1. Middleware redirects unauthenticated requests to `/login?next=<encodedPathAndQuery>`.
2. Login success redirects to validated `next` path.
3. `next` must be an internal path only (reject external URLs).

## Canonical URL Rules

1. Saved drawings always use `/drawing/[id]`.
2. Chat presence is not represented by a separate saved-drawing URL.
3. Unsaved or draft sessions use `/draw/[slug]`.
4. `/drawing/[id]` is the only canonical URL for a persisted drawing.

## Data Model Assumptions for Routing

1. `chat.drawingId` is nullable.
2. `chat.drawingId IS NULL` means draft/unsaved chat session.
3. `chat.drawingId = drawing.id` means chat is attached to saved drawing.
4. Uniqueness is enforced for non-null `chat.drawingId` values (one chat per saved drawing).

Plain-English invariant:

1. A saved drawing can have zero or one chat.
2. A saved drawing cannot have two chats.
3. Draft chats can exist without any drawing yet.

## Lifecycle Flows

### Flow A: Drawing-first (no chat yet)

1. User starts at `/draw`.
2. User saves drawing.
3. App creates drawing row.
4. App redirects to `/drawing/[id]`.
5. If user starts chat later, create one chat with `drawingId = id`.

### Flow B: Chat-first before save

1. User starts at `/draw/[slug]` and creates chat.
2. Chat row exists with `drawingId = NULL`.
3. User saves drawing.
4. App creates drawing row.
5. App updates existing chat to set `drawingId = drawing.id`.
6. App redirects to `/drawing/[id]`.

### Flow C: Reopen draft chat

1. User visits `/chats`.
2. User selects chat where `drawingId IS NULL`.
3. App routes to `/draw/[slug]`.
4. Canvas may be empty while chat history remains available.

## Page Load Behavior

For `/drawing/[id]`:

1. Load drawing by `id` scoped to current user.
2. Load chat by `drawingId = id` scoped to current user.
3. If no chat exists, render drawing with empty chat panel state.

For `/draw/[slug]`:

1. Load draft context by slug scoped to current user.
2. Load associated chat history for that draft slug.
3. Render draft workspace, which may have no saved drawing.

## Concurrency and Integrity

1. Creating or attaching chat to a drawing should use a transaction.
2. On unique-constraint conflict for `drawingId`, fetch and return existing chat.
3. Always enforce account ownership in queries and mutations.

## Middleware Scope Notes

Exclude auth and static paths from protection matcher:

1. `/`
2. `/login`
3. `/sign-up`
4. `/_next/*`
5. `/favicon.ico` and public assets

## Future Extensions

1. Add chat status field (`draft`, `linked`, `archived`) for cleanup and UI clarity.
2. Add retention policy for stale `drawingId IS NULL` chats.
3. Keep `/drawing/[id]` stable even if chat features evolve.
