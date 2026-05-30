import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

export const chatRoleEnum = pgEnum('chat_role', ['system', 'user', 'assistant'])

export const usr = pgTable('usr', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const drawing = pgTable(
  'drawing',
  {
    id: uuid('id').primaryKey(),
    usrId: uuid('usr_id')
      .notNull()
      .references(() => usr.id),
    slug: text('slug'),
    title: text('title'),
    canvasStateJson: jsonb('canvas_state_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    snapshotDataUrl: text('snapshot_data_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('drawing_usr_id_idx').on(table.usrId)],
)

export const chat = pgTable(
  'chat',
  {
    id: uuid('id').primaryKey(),
    usrId: uuid('usr_id')
      .notNull()
      .references(() => usr.id),
    drawingId: uuid('drawing_id').references(() => drawing.id),
    slug: text('slug').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('chat_usr_id_idx').on(table.usrId),
    unique('chat_drawing_id_unq').on(table.drawingId),
  ],
)

export const chatMessage = pgTable(
  'chat_message',
  {
    id: uuid('id').primaryKey(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chat.id),
    role: chatRoleEnum('role').notNull(),
    content: jsonb('content').$type<unknown[]>().notNull(),
    sequence: integer('sequence').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    unique('chat_message_chat_id_sequence_unq').on(table.chatId, table.sequence),
    index('chat_message_chat_id_idx').on(table.chatId),
  ],
)

export type Usr = typeof usr.$inferSelect
export type NewUsr = typeof usr.$inferInsert

export type Drawing = typeof drawing.$inferSelect
export type NewDrawing = typeof drawing.$inferInsert

export type Chat = typeof chat.$inferSelect
export type NewChat = typeof chat.$inferInsert

export type ChatMessage = typeof chatMessage.$inferSelect
export type NewChatMessage = typeof chatMessage.$inferInsert
