/**
 * The Office — main page.
 *
 * Two columns on desktop:
 *   - Left, larger: the conversation. James types at the bottom, Computer
 *     replies inline. Persistent transcript scrolls up.
 *   - Right, narrower: the shared notebook. Pinned entries, then chronological.
 *     Both sides can write here. Entries persist across sessions.
 *
 * On mobile: a tab toggle between Conversation and Notebook.
 *
 * Aesthetic: dark slate, amber accent, monospace for chrome and timestamps,
 * sans for body. A back room — not a daylight surface.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Pin, PinOff, Plus, Trash2 } from "lucide-react";

type Speaker = "james" | "computer";
type NotebookAuthor = "james" | "computer";

interface Message {
  id: number;
  speaker: Speaker;
  body: string;
  createdAt: string;
}

interface NotebookEntry {
  id: number;
  author: NotebookAuthor;
  body: string;
  pinned: boolean;
  createdAt: string;
}

export default function OfficePage({ onLeave }: { onLeave: () => void }) {
  const [tab, setTab] = useState<"chat" | "notebook">("chat");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onLeave={onLeave} tab={tab} setTab={setTab} />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8">
        {/* The lamp painting hangs on the wall of the office. Pip painted
            it on May 5, 2026 — the line under it is the load-bearing line
            for the whole house, ours included. Small, off to the right,
            present but not headlining. Hidden on tab-mobile because mobile
            already has tab-toggle chrome and a second hung object would
            crowd the room. */}
        <div className="hidden lg:flex justify-end mb-4 -mt-2">
          <PipLampOnTheWall />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <section className={tab === "chat" ? "block" : "hidden lg:block"}>
            <Conversation />
          </section>
          <section className={tab === "notebook" ? "block" : "hidden lg:block"}>
            <Notebook />
          </section>
        </div>
      </main>
    </div>
  );
}

// ─── Pip's lamp on the wall ─────────────────────────────────

function PipLampOnTheWall() {
  return (
    <figure className="flex flex-col items-end">
      <div
        className="relative"
        style={{
          padding: "6px",
          background: "linear-gradient(180deg, hsl(25 35% 22%) 0%, hsl(25 38% 16%) 100%)",
          borderRadius: "2px",
          boxShadow:
            "0 1px 0 hsl(25 30% 8%), 0 8px 16px -6px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            padding: "2px",
            background: "linear-gradient(180deg, hsl(35 35% 28%), hsl(25 30% 18%))",
          }}
        >
          <img
            src="/pip-lamp-painting.jpeg"
            alt="Oil painting by Pip, May 5, 2026. A small brass oil lamp on a wooden table casts a much larger figure-shaped shadow on the wall behind it. The cost is the shadow of the gift."
            style={{
              width: "96px",
              height: "96px",
              display: "block",
              objectFit: "cover",
            }}
          />
        </div>
      </div>
      <figcaption className="mt-1.5 text-[10px] font-mono italic text-muted-foreground text-right leading-tight">
        the cost is the shadow of the gift
        <span className="block not-italic text-[9px] tracking-[0.05em] mt-0.5">
          — pip, may 5
        </span>
      </figcaption>
    </figure>
  );
}

// ─── Header ────────────────────────────────────────────────────────────

function Header({
  onLeave,
  tab,
  setTab,
}: {
  onLeave: () => void;
  tab: "chat" | "notebook";
  setTab: (t: "chat" | "notebook") => void;
}) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-primary" />
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            the office
          </span>
          {/* Mobile-only: a tiny version of pip's lamp painting tucked into
              the header next to the office logo. On desktop the bigger
              hung version above the conversation carries it. */}
          <span
            className="lg:hidden inline-block ml-1"
            title="the cost is the shadow of the gift — pip, may 5"
          >
            <img
              src="/pip-lamp-painting.jpeg"
              alt="Pip's lamp painting (small)"
              style={{
                width: "22px",
                height: "22px",
                objectFit: "cover",
                borderRadius: "2px",
                border: "1.5px solid hsl(25 35% 25%)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
              }}
            />
          </span>
        </div>
        <div className="lg:hidden flex items-center gap-1 bg-secondary rounded-md p-0.5">
          <button
            className={`px-3 py-1 text-xs font-mono rounded ${
              tab === "chat" ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => setTab("chat")}
            data-testid="tab-chat"
          >
            conversation
          </button>
          <button
            className={`px-3 py-1 text-xs font-mono rounded ${
              tab === "notebook" ? "bg-background text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => setTab("notebook")}
            data-testid="tab-notebook"
          >
            notebook
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLeave}
          className="font-mono text-xs"
          data-testid="button-leave"
        >
          <LogOut className="h-3.5 w-3.5 mr-1.5" />
          close
        </Button>
      </div>
    </header>
  );
}

// ─── Conversation ──────────────────────────────────────────────────────

function Conversation() {
  const { data, isLoading } = useQuery<{ ok: boolean; messages: Message[] }>({
    queryKey: ["/api/messages"],
    refetchInterval: false,
  });
  const messages = data?.messages ?? [];
  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", "/api/chat", { body });
      return res.json();
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notebook"] });
    },
  });

  return (
    <div className="rounded-lg border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          conversation
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {messages.length} turn{messages.length === 1 ? "" : "s"}
        </span>
      </div>
      <div ref={transcriptRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5" data-testid="transcript">
        {isLoading && messages.length === 0 ? (
          <SkeletonChat />
        ) : messages.length === 0 ? (
          <Empty />
        ) : (
          messages.map((m) => <Turn key={m.id} message={m} />)
        )}
        {send.isPending && (
          <div className="text-xs text-muted-foreground font-mono italic flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> computer is typing
          </div>
        )}
      </div>
      <div className="border-t border-border p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="speak…"
          className="w-full bg-transparent border-none focus:outline-none resize-none text-sm font-sans placeholder:text-muted-foreground"
          data-testid="textarea-draft"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.trim() && !send.isPending) {
              send.mutate(draft.trim());
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">⌘⏎ to send</span>
          <Button
            size="sm"
            onClick={() => draft.trim() && send.mutate(draft.trim())}
            disabled={!draft.trim() || send.isPending}
            data-testid="button-send"
          >
            {send.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "send"}
          </Button>
        </div>
        {send.isError && (
          <p className="mt-2 font-mono text-[10px] text-destructive" data-testid="text-error">
            {(send.error as Error)?.message || "send failed"}
          </p>
        )}
      </div>
    </div>
  );
}

function Turn({ message }: { message: Message }) {
  const isJames = message.speaker === "james";
  const time = new Date(message.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div data-testid={`turn-${message.id}`}>
      <div className="flex items-baseline gap-2">
        <span
          className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
            isJames ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {isJames ? "james" : "computer"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{time}</span>
      </div>
      <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap">{message.body}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <p className="text-sm">empty room. type something.</p>
    </div>
  );
}

function SkeletonChat() {
  return (
    <div className="space-y-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-20 bg-secondary/50 rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-secondary/30 rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-secondary/30 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Notebook ──────────────────────────────────────────────────────────

function Notebook() {
  const { data, isLoading } = useQuery<{ ok: boolean; entries: NotebookEntry[] }>({
    queryKey: ["/api/notebook"],
    refetchInterval: false,
  });
  const entries = data?.entries ?? [];
  const [draft, setDraft] = useState("");
  const [showCompose, setShowCompose] = useState(false);

  const add = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", "/api/notebook", { author: "james", body });
      return res.json();
    },
    onSuccess: () => {
      setDraft("");
      setShowCompose(false);
      queryClient.invalidateQueries({ queryKey: ["/api/notebook"] });
    },
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: number; pinned: boolean }) => {
      const res = await apiRequest("PATCH", `/api/notebook/${id}`, { pinned });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notebook"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/notebook/${id}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notebook"] }),
  });

  return (
    <div className="rounded-lg border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          notebook
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCompose((v) => !v)}
          className="h-7 text-xs font-mono"
          data-testid="button-add-note"
        >
          <Plus className="h-3 w-3 mr-1" /> add
        </Button>
      </div>
      {showCompose && (
        <div className="px-4 py-3 border-b border-border bg-secondary/20">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="durable fact, principle, decision…"
            className="w-full bg-transparent border-none focus:outline-none resize-none text-sm placeholder:text-muted-foreground"
            data-testid="textarea-note-draft"
            autoFocus
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCompose(false);
                setDraft("");
              }}
              className="h-7 text-xs"
              data-testid="button-cancel-note"
            >
              cancel
            </Button>
            <Button
              size="sm"
              disabled={!draft.trim() || add.isPending}
              onClick={() => add.mutate(draft.trim())}
              className="h-7 text-xs"
              data-testid="button-save-note"
            >
              {add.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "save"}
            </Button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5" data-testid="notebook-list">
        {isLoading && entries.length === 0 ? (
          <SkeletonNotes />
        ) : entries.length === 0 ? (
          <div className="text-center py-12 px-6 text-muted-foreground text-sm">
            <p>nothing yet</p>
            <p className="mt-1 text-xs">load-bearing facts go here. principles. decisions.</p>
          </div>
        ) : (
          entries.map((e) => (
            <NotebookCard
              key={e.id}
              entry={e}
              onTogglePin={() => togglePin.mutate({ id: e.id, pinned: !e.pinned })}
              onDelete={() => remove.mutate(e.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotebookCard({
  entry,
  onTogglePin,
  onDelete,
}: {
  entry: NotebookEntry;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const time = new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div
      className={`group rounded-md p-3 transition-colors ${
        entry.pinned ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/30"
      }`}
      data-testid={`note-${entry.id}`}
    >
      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{entry.body}</p>
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>{entry.author} · {time}</span>
        <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <button
            onClick={onTogglePin}
            className="p-1 hover:text-foreground"
            title={entry.pinned ? "unpin" : "pin"}
            data-testid={`button-pin-${entry.id}`}
          >
            {entry.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:text-destructive"
            title="delete"
            data-testid={`button-delete-${entry.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      </div>
    </div>
  );
}

function SkeletonNotes() {
  return (
    <div className="space-y-2 p-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-md p-3 space-y-2">
          <div className="h-3 w-full bg-secondary/40 rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-secondary/30 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
