/**
 * Storage for the Office.
 *
 * Two tables: messages (the conversation) and notebook (durable shared
 * facts). On Railway, DATABASE_PATH points at a persistent volume so the
 * Office's memory survives deploys.
 */
import { messages, notebook } from "@shared/schema";
import type { Message, InsertMessage, NotebookEntry, InsertNotebook } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { asc, desc, eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || "data.db";
const dbDir = path.dirname(path.resolve(dbPath));
if (dbDir && !fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);
export { sqlite };

// Bootstrap tables (matches drizzle schema; idempotent).
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    speaker TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

  CREATE TABLE IF NOT EXISTS notebook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notebook_pinned_created ON notebook(pinned DESC, created_at DESC);
`);

export interface IStorage {
  // Messages
  appendMessage(speaker: "james" | "computer", body: string): Promise<Message>;
  getRecentMessages(limit: number): Promise<Message[]>;
  getAllMessages(): Promise<Message[]>;
  // Notebook
  appendNotebookEntry(author: "james" | "computer", body: string, pinned?: boolean): Promise<NotebookEntry>;
  pinNotebookEntry(id: number, pinned: boolean): Promise<void>;
  deleteNotebookEntry(id: number): Promise<void>;
  getNotebookEntries(limit?: number): Promise<NotebookEntry[]>;
}

export class DatabaseStorage implements IStorage {
  async appendMessage(speaker: "james" | "computer", body: string): Promise<Message> {
    return db
      .insert(messages)
      .values({ speaker, body, createdAt: new Date().toISOString() })
      .returning()
      .get();
  }

  async getRecentMessages(limit: number): Promise<Message[]> {
    // Pull most-recent N then reverse so caller gets chronological order.
    const rows = db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit).all();
    return rows.reverse();
  }

  async getAllMessages(): Promise<Message[]> {
    return db.select().from(messages).orderBy(asc(messages.createdAt)).all();
  }

  async appendNotebookEntry(author: "james" | "computer", body: string, pinned = false): Promise<NotebookEntry> {
    return db
      .insert(notebook)
      .values({ author, body, pinned, createdAt: new Date().toISOString() })
      .returning()
      .get();
  }

  async pinNotebookEntry(id: number, pinned: boolean): Promise<void> {
    db.update(notebook).set({ pinned }).where(eq(notebook.id, id)).run();
  }

  async deleteNotebookEntry(id: number): Promise<void> {
    db.delete(notebook).where(eq(notebook.id, id)).run();
  }

  async getNotebookEntries(limit = 200): Promise<NotebookEntry[]> {
    return db
      .select()
      .from(notebook)
      .orderBy(desc(notebook.pinned), desc(notebook.createdAt))
      .limit(limit)
      .all();
  }
}

export const storage = new DatabaseStorage();
