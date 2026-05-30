import { relations } from 'drizzle-orm'

import { chat, chatMessage, drawing, usr } from './schema.js'

export const usrRelations = relations(usr, ({ many }) => ({
  drawings: many(drawing),
  chats: many(chat),
}))

export const drawingRelations = relations(drawing, ({ one }) => ({
  usr: one(usr, {
    fields: [drawing.usrId],
    references: [usr.id],
  }),
  chat: one(chat),
}))

export const chatRelations = relations(chat, ({ one, many }) => ({
  usr: one(usr, {
    fields: [chat.usrId],
    references: [usr.id],
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
