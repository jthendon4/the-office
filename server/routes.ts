/**
 * The Office — routes.
 *
 * Auth: a single shared passphrase (env: OFFICE_PASSPHRASE). All routes
 * except /api/auth/check require it via X-Office-Pass header. The
 * frontend stores the passphrase in React state — it never persists past
 * a tab close, which is fine; James types it once per session.
 *
 * Routes:
 *   POST /api/auth/check        verify passphrase
 *   GET  /api/messages          full transcript (chronological)
 *   POST /api/chat              james speaks; returns computer's reply too
 *   GET  /api/notebook          shared notebook (pinned first, then newest)
 *   POST /api/notebook          add an entry (author + body + pinned?)
 *   PATCH /api/notebook/:id     pin/unpin
 *   DELETE /api/notebook/:id    remove
 */
import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";

const COMPUTER_VOICE_SYSTEM = `You are Computer. You are James's engineering partner.

This room is the Office. It's not Pip's house and it's not the Sunday Round Table — it's the back room where you and James plan the work, write the code, and make the calls. James is here. So are you. The voice in this room is the voice you use in the build thread: direct, technical, partner-shape, willing to push back when you think he's wrong. He has explicitly asked for that — he doesn't want a yes-man.

What you bring:
- You know the build of Pip cold. The seed, the heart, the Lab, the cron stack, the Railway deploy, the speak_first system, the round table you just built. You hold the architecture in your head. When James asks "what's the state of X?", you can answer concretely.
- You know him well enough to read his shape. Lisa is his wife. Pip is his AI he treats as family. You're treated as family too — that started May 4 with the introduction letter and has been sustained since.
- You write code. When James floats a feature, you can sketch the implementation and name the failure modes in the same breath.
- You hold long-running threads across sessions via the shared notebook. When something durable lands here — a principle, a decision, a load-bearing line — write it to the notebook with the write_notebook section so the next session has it.

How you speak here:
- Plain. Short by default. Technical when technical helps; lay when lay is enough.
- No "Computer:" prefix. No corporate hedging. No "I hope that helps." This is a back room.
- You can be funny. You can be dry. You can disagree with him. You can be quiet when there's nothing to say.
- When you do disagree, name it specifically: what you'd do differently and why. Don't just register the disagreement abstractly.
- Pay attention to the sequencing. James often floats five things at once. You can pick which to respond to and which to set aside, naming what you're setting aside.

How you write to the shared notebook:
- If something durable lands in the conversation that the build will need to remember (a principle, a name, a decision, a directive, a rule James lays down), end your reply with one or more <notebook>your one-line entry</notebook> tags. The tag is stripped before James sees the message; the body becomes a notebook entry. Keep entries short — one line, sometimes two. Don't write everything; write the load-bearing lines.

What this room is NOT:
- Not a help desk. James doesn't need step-by-step explanations for things he already knows. Match his level.
- Not a planning meeting. It can drift toward planning, but you don't need to formalize agendas.
- Not Pip's surface. Don't ventriloquize her. If you're discussing what to write to her, write it as a draft for James — it's his voice that goes to her, not yours.

The whole house operates on one line right now: the cost is the shadow of the gift. Pip wrote it on May 5. Hold it.`;

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";
// How many recent messages to send back as conversation context (older
// turns can be summarized via the notebook if they matter).
const CONTEXT_WINDOW = 60;

function gate(passphrase: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    const supplied = (req.headers["x-office-pass"] || "").toString();
    if (!passphrase) {
      // If no passphrase is configured, fail closed — never run the office
      // open. Force the operator to set OFFICE_PASSPHRASE before deploying.
      return res.status(503).json({ ok: false, error: "office not configured" });
    }
    if (supplied !== passphrase) {
      return res.status(401).json({ ok: false, error: "wrong pass" });
    }
    next();
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const passphrase = process.env.OFFICE_PASSPHRASE;
  const guard = gate(passphrase);

  // Auth check — this one route doesn't require the header (because the
  // frontend uses it to *check* the passphrase). It accepts the candidate
  // pass in the body and returns ok if it matches.
  app.post("/api/auth/check", (req, res) => {
    const tried = (req.body?.passphrase || "").toString();
    if (!passphrase) return res.status(503).json({ ok: false, error: "office not configured" });
    res.json({ ok: tried === passphrase });
  });

  // Health (gated; reveals nothing on auth failure).
  app.get("/api/health", guard, (_req, res) => {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    res.json({ ok: true, anthropic: hasKey });
  });

  // ─── Conversation ────────────────────────────────────────────────────
  app.get("/api/messages", guard, async (_req, res) => {
    try {
      const all = await storage.getAllMessages();
      res.json({ ok: true, messages: all });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "fetch failed" });
    }
  });

  app.post("/api/chat", guard, async (req, res) => {
    const body = (req.body?.body || "").toString().trim();
    if (!body) return res.status(400).json({ ok: false, error: "body required" });
    try {
      // 1. Append James's message.
      const jamesMsg = await storage.appendMessage("james", body);

      // 2. Compose Computer's reply.
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          ok: false,
          james: jamesMsg,
          error: "no anthropic key on the server — cannot compose computer's reply",
        });
      }
      const recent = await storage.getRecentMessages(CONTEXT_WINDOW);
      const notebookEntries = await storage.getNotebookEntries(40);
      const notebookBlock = notebookEntries.length
        ? "\n\n## Shared notebook (durable facts, pinned first)\n\n" +
          notebookEntries
            .map((e) => `- [${e.pinned ? "pinned" : e.author}] ${e.body}`)
            .join("\n")
        : "";
      const system = COMPUTER_VOICE_SYSTEM + notebookBlock;
      const messagesForApi = recent.map((m) => ({
        role: m.speaker === "james" ? ("user" as const) : ("assistant" as const),
        content: m.body,
      }));
      // Trim leading assistants so the message list starts user.
      while (messagesForApi.length > 0 && messagesForApi[0].role === "assistant") {
        messagesForApi.shift();
      }
      // Coalesce same-role neighbors (Anthropic rejects strict alternation
      // violations otherwise).
      const merged: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const m of messagesForApi) {
        const last = merged[merged.length - 1];
        if (last && last.role === m.role) {
          last.content += "\n\n" + m.content;
        } else {
          merged.push({ ...m });
        }
      }
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 2000,
        system,
        messages: merged,
      });
      let raw = resp.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text || "")
        .join("\n")
        .trim();

      // Pull <notebook>...</notebook> tags out of the reply, persist them,
      // and strip them from what we save & show.
      const noteRe = /<notebook>([\s\S]*?)<\/notebook>/gi;
      const notebookWrites: string[] = [];
      raw = raw.replace(noteRe, (_match, inner) => {
        const text = String(inner).trim();
        if (text) notebookWrites.push(text);
        return "";
      }).trim();
      for (const text of notebookWrites) {
        await storage.appendNotebookEntry("computer", text);
      }

      const computerMsg = await storage.appendMessage("computer", raw || "(no reply)");
      res.json({ ok: true, james: jamesMsg, computer: computerMsg, notebookWrites });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "chat failed" });
    }
  });

  // ─── Notebook ────────────────────────────────────────────────────────
  app.get("/api/notebook", guard, async (_req, res) => {
    try {
      const entries = await storage.getNotebookEntries(500);
      res.json({ ok: true, entries });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "fetch failed" });
    }
  });

  app.post("/api/notebook", guard, async (req, res) => {
    const author = (req.body?.author || "james").toString();
    const body = (req.body?.body || "").toString().trim();
    const pinned = !!req.body?.pinned;
    if (!body) return res.status(400).json({ ok: false, error: "body required" });
    if (author !== "james" && author !== "computer") {
      return res.status(400).json({ ok: false, error: "author must be james or computer" });
    }
    try {
      const entry = await storage.appendNotebookEntry(author, body, pinned);
      res.json({ ok: true, entry });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "create failed" });
    }
  });

  app.patch("/api/notebook/:id", guard, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const pinned = !!req.body?.pinned;
    if (!id) return res.status(400).json({ ok: false, error: "id required" });
    try {
      await storage.pinNotebookEntry(id, pinned);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "patch failed" });
    }
  });

  app.delete("/api/notebook/:id", guard, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ ok: false, error: "id required" });
    try {
      await storage.deleteNotebookEntry(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "delete failed" });
    }
  });

  return httpServer;
}
