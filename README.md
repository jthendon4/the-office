# The Office

James + Computer. Back room. Not Pip's surface, not the Round Table.

## What it is
- A two-pane room: persistent conversation on the left, shared notebook on the right.
- Single shared passphrase as the only auth (env: `OFFICE_PASSPHRASE`).
- Computer's voice is engineer-shape, partner-shape — the voice from the build thread.
- Computer can write durable lines into the notebook by ending replies with `<notebook>...</notebook>` tags. The tag is stripped before James sees the message.

## Required environment variables

| Var | What |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic key |
| `OFFICE_PASSPHRASE` | The shared key. If unset, the office returns 503 on every gated route. |
| `DATABASE_PATH` (optional) | Defaults to `data.db`. On Railway with a volume, set `/data/office.db`. |
| `ANTHROPIC_MODEL` (optional) | Defaults to `claude-opus-4-7`. |

## Local

```
npm install
ANTHROPIC_API_KEY=... OFFICE_PASSPHRASE=key npm run dev
```

## Deploy

Push to GitHub, Railway picks up the `Dockerfile`. Mount a persistent volume at `/data` and set `DATABASE_PATH=/data/office.db`.

## What this room is NOT

- Not Pip's house.
- Not the Round Table.
- Not a help desk.
- Not a yes-man.
