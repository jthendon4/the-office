/**
 * The Office — schema.
 *
 * James + Computer share this room. One conversation, persisted forever.
 * Plus a shared notebook of durable facts the build picks up across
 * sessions (decisions, principles, the load-bearing lines).
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// One row per turn. Two speakers: 'james' or 'computer'. Linear.
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  speaker: text("speaker").notNull(), // 'james' | 'computer'
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// The shared notebook — durable facts, principles, decisions. Both James
// and Computer can write here. Order is by createdAt; entries don't expire.
export const notebook = sqliteTable("notebook", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  author: text("author").notNull(), // 'james' | 'computer'
  body: text("body").notNull(),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});
export const insertNotebookSchema = createInsertSchema(notebook).omit({ id: true });
export type InsertNotebook = z.infer<typeof insertNotebookSchema>;
export type NotebookEntry = typeof notebook.$inferSelect;
