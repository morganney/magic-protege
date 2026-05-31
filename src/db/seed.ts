import { reset, seed } from 'drizzle-seed'
import type { SaveDetail } from 'magic-crayon'

import { hashPassword } from '../auth/password.js'
import { db, schema, sql } from './client.js'

/*
 * Seed strategy (two phases):
 * 1) Use drizzle-seed refine/with generation to create a deterministic relational
 *    graph with valid foreign-key links and predictable cardinality.
 * 2) Apply deterministic post-seed SQL updates for richer JSON columns that require
 *    object/array payloads not supported by valuesFromArray primitive generators.
 *
 * This preserves referential integrity while producing realistic canvas/chat payload
 * shapes for local development and integration testing.
 */

type SeedCanvasState = Omit<SaveDetail, 'data'> & {
  document: NonNullable<SaveDetail['document']>
}

type AiSdkStyleContentPart =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args: Record<string, unknown>
    }
  | {
      type: 'tool-result'
      toolCallId: string
      toolName: string
      result: Record<string, unknown>
    }

const snapshotDataUrls = [
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
  'data:image/gif;base64,R0lGODlhAQABAIAAAAD///8AACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
]

const canvasStateTemplates: SeedCanvasState[] = [
  {
    serialization: 'dataurl',
    timestamp: '2026-05-22T12:00:00.000Z',
    meta: {
      view: ['1280', '720'],
      resolution: ['2560', '1440'],
      backgroundColor: '#ffffff',
    },
    document: {
      version: 1,
      strokes: [
        {
          mode: 'draw',
          strokeStyle: '#2f5d8a',
          lineCap: 'round',
          lineJoin: 'round',
          lineWidth: 6,
          compositing: 'source-over',
          sourceWidth: 1280,
          sourceHeight: 720,
          points: [
            { x: 120, y: 180 },
            { x: 260, y: 220 },
            { x: 410, y: 210 },
          ],
        },
      ],
    },
  },
  {
    serialization: 'dataurl',
    timestamp: '2026-05-22T12:10:00.000Z',
    meta: {
      view: ['1280', '720'],
      resolution: ['1920', '1080'],
      backgroundColor: '#ffffff',
    },
    document: {
      version: 1,
      strokes: [
        {
          mode: 'draw',
          strokeStyle: '#c0392b',
          lineCap: 'round',
          lineJoin: 'round',
          lineWidth: 5,
          compositing: 'source-over',
          sourceWidth: 1280,
          sourceHeight: 720,
          points: [
            { x: 150, y: 120 },
            { x: 210, y: 180 },
            { x: 280, y: 130 },
            { x: 350, y: 190 },
          ],
        },
        {
          mode: 'erase',
          strokeStyle: '#000000',
          lineCap: 'round',
          lineJoin: 'round',
          lineWidth: 10,
          compositing: 'destination-out',
          sourceWidth: 1280,
          sourceHeight: 720,
          points: [
            { x: 230, y: 160 },
            { x: 250, y: 165 },
          ],
        },
      ],
    },
  },
]

const aiSdkStyleContentTemplates: AiSdkStyleContentPart[][] = [
  [
    {
      type: 'text',
      text: 'Could we add a brighter sky near the top?',
    },
  ],
  [
    {
      type: 'text',
      text: 'I can apply a soft blue gradient and keep your lines intact.',
    },
    {
      type: 'tool-call',
      toolCallId: 'tool-call-1',
      toolName: 'apply_canvas_commands',
      args: {
        intent: 'brighten-sky',
      },
    },
  ],
  [
    {
      type: 'text',
      text: 'Applied the edits. Want me to add cloud highlights?',
    },
    {
      type: 'tool-result',
      toolCallId: 'tool-call-1',
      toolName: 'apply_canvas_commands',
      result: {
        ok: true,
      },
    },
  ],
]

const canvasStateTemplateJson = canvasStateTemplates.map(template =>
  JSON.stringify(template),
)

const aiSdkStyleContentTemplateJson = aiSdkStyleContentTemplates.map(template =>
  JSON.stringify(template),
)

const defaultSeedPassword = 'local-dev-password'

function getNumberEnv(name: string, fallback: number) {
  const value = process.env[name]
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`)
  }

  return parsed
}

async function main() {
  const shouldReset = process.argv.includes('--reset')
  const shouldSeedIfEmpty = process.argv.includes('--if-empty')
  const count = getNumberEnv('SEED_COUNT', 10)
  const seedValue = getNumberEnv('SEED_VALUE', 42)
  const seedPassword = process.env.SEED_PASSWORD ?? defaultSeedPassword
  const seedPasswordHash = await hashPassword(seedPassword)

  if (shouldReset) {
    await reset(db, schema)
  }

  if (shouldSeedIfEmpty) {
    const [{ hasRows }] = await sql<{ hasRows: boolean }[]>`
      select exists (select 1 from "usr" limit 1) as "hasRows"
    `

    if (hasRows) {
      console.log('Seed skipped: usr table already has rows.')
      return
    }
  }

  await seed(db, schema, { count, seed: seedValue }).refine(funcs => ({
    usr: {
      count,
      columns: {
        email: funcs.email(),
        displayName: funcs.fullName(),
        passwordHash: funcs.valuesFromArray({ values: [seedPasswordHash] }),
      },
      with: {
        drawing: [
          { weight: 0.7, count: [1] },
          { weight: 0.3, count: [2] },
        ],
        chat: [
          { weight: 0.5, count: [1] },
          { weight: 0.5, count: [2] },
        ],
      },
    },
    drawing: {
      columns: {
        slug: funcs.string({ isUnique: true }),
        title: funcs.loremIpsum({ sentencesCount: 1 }),
        canvasStateJson: funcs.default({ defaultValue: {} }),
        snapshotDataUrl: funcs.valuesFromArray({ values: snapshotDataUrls }),
      },
    },
    chat: {
      columns: {
        drawingId: funcs.default({ defaultValue: null }),
        slug: funcs.uuid(),
      },
      with: {
        chatMessage: [
          { weight: 0.6, count: [1, 2] },
          { weight: 0.3, count: [3] },
          { weight: 0.1, count: [4] },
        ],
      },
    },
    chatMessage: {
      columns: {
        role: funcs.valuesFromArray({ values: ['user', 'assistant', 'system'] }),
        content: funcs.default({ defaultValue: [] }),
        sequence: funcs.intPrimaryKey(),
      },
    },
  }))

  /*
   * Assign deterministic canvas state templates after seeding because drizzle-seed
   * generators for valuesFromArray only support primitive arrays.
   */
  await sql`
    with ranked_drawings as (
      select
        id,
        row_number() over (order by created_at, id) as rank
      from drawing
    )
    update drawing as d
    set canvas_state_json =
      case
        when (rd.rank % 2) = 1 then ${canvasStateTemplateJson[0]}::jsonb
        else ${canvasStateTemplateJson[1]}::jsonb
      end
    from ranked_drawings as rd
    where d.id = rd.id
  `

  /*
   * Assign deterministic AI SDK-style content and aligned role values so seeded
   * chat transcripts are reproducible and structurally realistic.
   */
  await sql`
    with ranked_messages as (
      select
        id,
        row_number() over (order by created_at, id) as rank
      from chat_message
    )
    update chat_message as m
    set
      content =
        case
          when (rm.rank % 3) = 1 then ${aiSdkStyleContentTemplateJson[0]}::jsonb
          when (rm.rank % 3) = 2 then ${aiSdkStyleContentTemplateJson[1]}::jsonb
          else ${aiSdkStyleContentTemplateJson[2]}::jsonb
        end,
      role =
        case
          when (rm.rank % 3) = 1 then 'user'::chat_role
          else 'assistant'::chat_role
        end
    from ranked_messages as rm
    where m.id = rm.id
  `

  /*
   * Link chats to drawings by per-user rank; odd-ranked chats remain linked and
   * even-ranked chats stay unlinked to preserve chat-first scenarios in seed data.
   */
  await sql`
    with ranked_drawings as (
      select
        id,
        usr_id,
        row_number() over (partition by usr_id order by created_at, id) as rank
      from drawing
    ),
    ranked_chats as (
      select
        id,
        usr_id,
        row_number() over (partition by usr_id order by created_at, id) as rank
      from chat
    )
    update chat as c
    set drawing_id = d.id
    from ranked_chats as rc
    inner join ranked_drawings as d
      on d.usr_id = rc.usr_id
      and d.rank = rc.rank
    where c.id = rc.id
      and (rc.rank % 2 = 1)
  `

  /*
   * Guarantee at least one chat-first row on every seed run by clearing drawing_id
   * for the earliest chat only when no unlinked chats exist.
   */
  await sql`
    with chat_stats as (
      select count(*) filter (where drawing_id is null) as null_drawing_count
      from chat
    ),
    first_chat as (
      select id
      from chat
      order by created_at, id
      limit 1
    )
    update chat as c
    set drawing_id = null
    from chat_stats as cs, first_chat as fc
    where c.id = fc.id
      and cs.null_drawing_count = 0
  `
}

try {
  await main()
} catch (error) {
  console.error('Error seeding database:', error)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
