import { relations } from 'drizzle-orm'

import { account, chat, chatMessage, drawing } from './schema.js'

export const accountRelations = relations(account, ({ many }) => ({
  drawings: many(drawing),
  chats: many(chat),
}))

export const drawingRelations = relations(drawing, ({ one, many }) => ({
  account: one(account, {
    fields: [drawing.accountId],
    references: [account.id],
  }),
  chats: many(chat),
}))

export const chatRelations = relations(chat, ({ one, many }) => ({
  account: one(account, {
    fields: [chat.accountId],
    references: [account.id],
  }),
  drawing: one(drawing, {
    fields: [chat.drawingId],
    references: [drawing.id],
  }),
  messages: many(chatMessage),
}))

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  chat: one(chat, {
    fields: [chatMessage.chatId],
    references: [chat.id],
  }),
}))
