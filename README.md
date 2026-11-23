# dot 🥏

![Status](https://status.leojan.fr/api/badge/3/status) ![Uptime](https://status.leojan.fr/api/badge/3/uptime/24)

[Monitoring status page](https://status.leojan.fr/status/bot)

A TypeScript Telegram bot for Ultimate Frisbee trainings: it announces each training the day
before, counts who is coming from 👍 reactions, reminds the team and warns the trainers when
too few players are in, and posts a rules quiz.

## What it does

One training, at time T (the practice start of the season, or `EXCEPTIONAL_TIME`):

| When | What | Where |
|---|---|---|
| T-24h | **Announcement**: location, start (and throwing) time; react 👍 or 👎 | Team chat |
| T-24h | **Key request**: key holders react 👍 if bringing the hall key, 😢 if they have it but can't come (per-season toggle) | Team chat |
| T-24h | **Trainer request**: who coaches (`ENABLE_TRAINER_MESSAGES`) | Trainer chat |
| T-24h | **Quiz question** (`RULES_QUIZ_ENABLED`) | Rules chat |
| T-24h + `RULES_ANSWER_DELAY_MINUTES` | **Quiz answer**, behind a spoiler | Rules chat |
| T-`REMINDER_HOURS_BEFORE` (3h) | **Attendance reminder**, only if 👍 < threshold | Team chat, reply to the announcement |
| T-`CANCEL_HOURS_BEFORE` (1h) | **Cancellation notice**, only if still 👍 < threshold | Trainer chat |

- The T-24h run is a daily cron at each practice time: it posts if a training starts at that
  time tomorrow. The announcement goes out 24h before the **regular** time, even when
  `EXCEPTIONAL_TIME` moves the training; the checks count from the new start.
- Only 👍 counts. The threshold is `WINTER_MIN_ATTENDANCE` / `SUMMER_MIN_ATTENDANCE`.
- The announcement, trainer request and attendance reminder are written by the LLM when Ollama is
  enabled, else from templates (also the fallback when the LLM fails or takes over 3 min). The key
  request and cancellation notice are always templates.
- A failed announcement is retried once 10 min later, a failed quiz question too; what still
  failed is reported to the admin chat. One failed message never stops the others.
- A cancelled training (`EXCEPTIONAL_CANCELLED=true`) gets nothing in the team or trainer chat;
  the quiz still goes out.
- Restart-safe: on startup the bot re-arms the next training's checks and the pending quiz answer,
  reading the chat history to skip what was already sent. A check whose time passed runs at once.

> **Why a user account is required.** The Telegram **Bot API cannot read reactions**. Both
> reaction-read methods (`messages.getMessagesReactions`, `messages.getMessageReactionsList`)
> are documented *"Only users can use this method"*. So the bot writes the messages, and a
> separate MTProto client, logged in as **your own Telegram account**, reads the counts and
> the chat history. Setup: [MTProto setup](#mtproto-setup).

## Setup

### Prerequisites

- Node.js at the `NODE_VERSION` of `Dockerfile` (local runs)
- Docker with Compose (deployment)
- A bot token from [@BotFather](https://t.me/BotFather)

### Chat ids

1. Add the bot to the chat and send a message
2. Open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find `"chat":{"id":-100…}` (negative for groups); a topic's id is its `message_thread_id`

### `.env`

```bash
cp .env.example .env    # then fill it in, see Configuration
```

### MTProto setup

The bot also logs in as **your own Telegram account** to read reactions and history. Three
values are needed.

**Get `api_id` / `api_hash`:**

1. Go to [my.telegram.org](https://my.telegram.org) and log in with the phone number of the
   account that is **in the frisbee group**. Telegram sends the login code *inside the
   Telegram app*, not by SMS.
2. Click **API development tools**.
3. Fill the form — *App title*: `frisbee-bot`, *Short name*: `frisbeebot`, *Platform*: `Other`.
4. Copy the resulting **`api_id`** (a number) and **`api_hash`** (32-char hex) into `.env`.

**Mint your session string:**

```bash
npm run mtproto:login     # run on your machine, not in Docker - it needs a terminal
```

It asks for your phone number, then the login code Telegram sends you in-app, then your 2FA
password if you have one. Paste the printed string into `.env` as `TELEGRAM_SESSION`.

```env
TELEGRAM_API_ID=1234567
TELEGRAM_API_HASH=0123456789abcdef0123456789abcdef
TELEGRAM_SESSION=1BQANOTEuMTA4LjU2...
```

> ### ⚠️ Treat `TELEGRAM_SESSION` like a password
> Unlike a bot token, it grants **full access to your Telegram account** — it can read every
> chat you are in and send messages as you. A leak is an *account takeover*. Never commit it,
> never log it, never paste it anywhere.
>
> To revoke: Telegram → **Settings → Devices** → terminate the session.

The account must be a **member** of the team chat (reactions, announcement), the trainer chat
(already-sent cancellation notices) and the rules chat (asked questions). At startup the bot
logs an error for each of these chats the account cannot see. Reactions must be enabled in the
team chat with 👍 available.

## Configuration

All from environment variables (`.env`, read by `docker-compose.yml`). The bot refuses to start
with a message naming every invalid one. Booleans: `true`, anything else is false; empty = default.

| Variable | Default | Meaning |
|---|---|---|
| **Telegram** | | |
| `TELEGRAM_BOT_TOKEN` | required | Bot token |
| `TEAM_CHAT_ID` | required | Team chat |
| `TEAM_CHAT_THREAD_ID` | | Team chat topic |
| `TRAINER_CHAT_ID` | required | Trainer chat |
| `TRAINER_CHAT_THREAD_ID` | | Trainer chat topic |
| `ADMIN_CHAT_ID` | required | Admin chat: admin commands, failure alerts |
| `ENABLE_TRAINER_MESSAGES` | `true` | Trainer request and cancellation notice |
| **MTProto** ([setup](#mtproto-setup)) | | |
| `TELEGRAM_API_ID` | required | From my.telegram.org |
| `TELEGRAM_API_HASH` | required | From my.telegram.org |
| `TELEGRAM_SESSION` | required | Secret, from `npm run mtproto:login` |
| **Seasons** (`WINTER_*`, `SUMMER_*`) | | |
| `WINTER_START_DATE`, `SUMMER_START_DATE` | required | `month:day`, e.g. `9:15`; a season ends the day before the other starts |
| `WINTER_LOCATION`, `SUMMER_LOCATION` | required | Name, or `[Name](url)` to link it |
| `WINTER_PRACTICE_DAYS`, `SUMMER_PRACTICE_DAYS` | required | `day:HH:MM,…`, one per weekday, 0 = Sunday … 6 = Saturday; e.g. `2:20:30,6:21:00` |
| `WINTER_THROWING_MINUTES_BEFORE`, `SUMMER_THROWING_MINUTES_BEFORE` | `0` | Throwing session shown this long before the start, 0 = none |
| `WINTER_KEY_MESSAGE_ENABLED`, `SUMMER_KEY_MESSAGE_ENABLED` | `true` | Key request |
| **Attendance** | | |
| `WINTER_MIN_ATTENDANCE`, `SUMMER_MIN_ATTENDANCE` | `8` | 👍 needed, else reminder then cancellation notice |
| `REMINDER_HOURS_BEFORE` | `3` | Attendance reminder, hours before the start |
| `CANCEL_HOURS_BEFORE` | `1` | Cancellation notice, hours before the start; must be below `REMINDER_HOURS_BEFORE` |
| **Exceptional training** | | Applies to **every** training until removed and redeployed |
| `EXCEPTIONAL_LOCATION` | | Replaces the season location |
| `EXCEPTIONAL_TIME` | | `HH:MM`, replaces the start time |
| `EXCEPTIONAL_CANCELLED` | `false` | Nothing sent to team or trainers; `/training` says cancelled |
| **Rules quiz** ([details](#rules-quiz)) | | |
| `RULES_QUIZ_ENABLED` | `false` | Quiz question with each announcement |
| `RULES_CHAT_ID` | required if enabled | Group or channel (starts with `-`), not a private chat |
| `RULES_CHAT_THREAD_ID` | | Rules chat topic |
| `RULES_ANSWER_DELAY_MINUTES` | `60` | Between the question and its answer |
| `RULES_SIGNALS_EVERY_OTHER` | `false` | Every other question is a hand signal |
| **LLM** | | |
| `OLLAMA_ENABLED` | `false` (Docker: `true`) | LLM-written posts |
| `OLLAMA_HOST` | `http://localhost:11434` | Local runs only; Docker uses the `ollama` service |
| `OLLAMA_MODEL` | `llama3.2:3b` | Model, pulled by `ollama-setup` in Docker |
| **Docker only** | | |
| `TZ` | `Europe/Brussels` | Zone of the schedule and every date (locally: the machine's) |
| `APP_PORT` | `3004` | Host port of the health server (container: 3004) |
| `OLLAMA_VERSION` | `0.40.17` | `ollama/ollama` image tag |
| `OLLAMA_MEMORY_LIMIT` | `5G` | Ollama container memory limit |
| `OLLAMA_MEMORY_RESERVATION` | `4G` | Ollama container memory reservation |

A new variable goes in `src/config/env.ts`, the `environment:` list of `docker-compose.yml`,
`.env.example` and this table (tests check all four).

## Commands

Same list as `/help` in the admin chat (a test keeps them equal). Elsewhere, `/help` shows the
public ones only; admin commands only run in the admin chat and are ignored silently elsewhere.

```
/start - Meet dot
/help - List the commands
/info - Show the season schedules
/training - Show the next training
/quiz - Practise with a random rules quiz question (private chat)

Admin only:
/preview - Preview what the next training gets
/send_to_team - Post the announcement to the team chat
/send_to_all - Post the announcement, requests and quiz question now
/attendance - Show how many players are in so far
/quiz_preview [id] - Preview a quiz question and its answer here
/quiz_post - Post the next quiz question to the rules chat
/quiz_answer - Post the answer to the latest quiz question now
/quiz_stats - Show where the quiz rounds stand and the last questions asked
/status - Show what the bot will do next
```

- `/training`: weekday, date, countdown, time, location; once announced, "N of M players in" with
  a link to the announcement (count cached 1 min, left out when it can't be read within 5 s).
- `/quiz`: see [Practice](#practice). In a group, it points to the private chat.
- `/preview`: buttons pick the message, as the next training would get it: everything the
  T-24h run posts, or one of announcement, key request, trainer request, attendance reminder,
  cancellation notice (sample counts), and LLM or template when Ollama is enabled. Previews stay
  in the admin chat; it says when a message would not be sent (disabled, cancelled).
- `/send_to_all`: the T-24h run now, with a sent / skipped / failed line per message.
- `/attendance`: live 👍 count on the announcement vs the threshold.
- `/status`: next training, announcement (posted or due), players in, reminder and cancellation
  checks (armed, ran or skipped), quiz answer due, Telegram / MTProto / LLM up or down, version
  and uptime. Changes nothing.
- `/quiz_stats`: per mode (indoor, outdoor): round, rounds completed, asked / total in the
  current round, by source and difficulty, plus the 5 latest questions with date and id. Says so
  when the rules chat history can't be read (MTProto down).

## Rules quiz

With each announcement, the bot posts a quiz poll on the rules of Ultimate to the rules chat.
Voters see the right option as soon as they vote. `RULES_ANSWER_DELAY_MINUTES` later, it replies
with the answer, explanation and rule link, behind a spoiler.

- Questions match the season: indoor (EUF) ones in winter, outdoor ones in summer.
- Rounds: the least-asked questions of the mode come first, counted from the rules chat history.
  The difficulty changes from one question to the next when possible.
- `RULES_SIGNALS_EVERY_OTHER=true`: hand signals and the other questions alternate, each with its
  own round.
- The bot must be able to post in `RULES_CHAT_ID`; the MTProto account must be a member (it reads
  the history).
- `/quiz_preview [id]` shows a question and its answer in the current chat; without an id, it
  picks the way the scheduler would. Nothing is posted to the rules chat.

### Practice

In a private chat with the bot, `/quiz` sends a random question of the next training's mode,
rendered like `/quiz_preview`: poll, then the answer behind a spoiler. Buttons under the answer:
`Another` (same pool), `Indoor`, `Outdoor`, `Signals`. One question every 5 s per chat. Practice
never touches the rules chat: nothing posted or read there, so the rotation is unchanged.

### Adding questions

The question bank lives in `src/quiz/data/`, one `QuizBatch` file per source document:
its `source` (`title`, `url`) and its `questions`. A new file must be added to
`QUIZ_BATCHES` in `index.ts`.

```ts
{
  id: 'in_01',               // Hashtag-safe, never renamed once posted
  difficulty: 'easy',        // easy | medium | hard
  modes: INDOOR_ONLY,        // ALL_MODES, OUTDOOR_ONLY or INDOOR_ONLY
  ref: '9.5.1',              // Optional: WFDF rule number, linked on urules.org
  question: 'What is the standard size of an indoor field (EUF)?',
  answer: '40 × 20 metres',
  wrong: ['100 × 37 metres', '60 × 30 metres', '30 × 15 metres'],  // Shuffled with the answer
  explanation: 'Indoors (EUF), the field is 40 × 20 metres...',     // Optional
  image: 'assets/signals/01-foul.png',  // Optional: photo sent before the poll
  answerImage: 'assets/...png'          // Optional: photo sent with the answer
}
```

The bot remembers which questions it asked by id, so an id must never be renamed once posted.
`npm test` checks the bank against Telegram's poll limits. Preview a new question with
`/quiz_preview <id>`.

Hand-signal images in `assets/signals/` are cropped from the WFDF Hand Signals PDF.

**Sources and licence.** Questions are adapted from the
[WFDF Rules of Ultimate 2025-2028](https://rules.wfdf.sport/) and related WFDF rules
documents, © World Flying Disc Federation, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Indoor questions are adapted
from the [EUF Indoor Rules Appendix](https://www.ultimatefederation.eu/rules-of-ultimate).

## Health

The bot serves health endpoints on port 3004. Each dependency is `ok`, `disabled` or `down`;
probes time out after 5 s.

- **`GET /health`**: "the bot works": 503 only when Telegram is down (MTProto and Ollama are
  optional, templates are the LLM fallback). Used by the compose healthcheck.
  ```json
  {
    "status": "ok",
    "checks": {
      "telegram": { "status": "ok", "responseTimeMs": 112 },
      "mtproto": { "status": "down" },
      "ollama": { "status": "disabled" }
    },
    "timestamp": "2026-11-15T23:50:01.000Z"
  }
  ```
- **`GET /health/telegram`**, **`/health/mtproto`**, **`/health/ollama`**: one dependency, 503
  when it is not `ok` (Ollama disabled included).
  ```json
  { "name": "ollama", "status": "down", "responseTimeMs": 5001, "error": "Ollama did not answer within 5000ms", "timestamp": "..." }
  ```

MTProto status is the reader's connection state (no request); a request that finds the
connection dead reconnects and retries once.

Uptime Kuma: HTTP monitors on `http://frisbee-bot:3004/health` (bot) and
`http://frisbee-bot:3004/health/ollama` (LLM), 60 s interval.

## Deployment

**Production**: Dokploy redeploys on every push to `main`, with `docker-compose.yml` plus
`docker-compose.prod.yml` (only the bot joins `dokploy-network`, Ollama stays private). Secrets
live in `.env` on the host, never committed.

`docker-compose.yml` runs three services:
- `frisbee-bot`: the bot (`node dist/main.js`, multi-stage image, `node` user), health port on
  `APP_PORT`, healthcheck on `/health`. It starts without waiting for Ollama: templates cover a
  missing LLM.
- `ollama`: the LLM, port 11434 on `127.0.0.1` only (for `npm run dev`).
- `ollama-setup`: pulls `OLLAMA_MODEL` once, then exits.

On SIGTERM the bot stops polling, timers, cron, health server and MTProto, within 5 s.

**Docker, locally** (bot + Ollama, pulls the model): `npm run docker:up`.

**Release**: on `main`, after a user-visible change ships,
`npm run release -- patch|minor|major` (bumps `version`, commits, tags `vX.Y.Z`), then
`git push --follow-tags`. `/status` shows the version.

## Development

```bash
npm install
npm run dev             # Run the bot from src/, restarts on change
npm run verify          # Type-check, lint, knip, tests: run before every push
npm test                # Tests
npm run test:coverage   # Tests with coverage thresholds
npm run lint            # Lint + formatting check
npm run format          # Fix lint + formatting
npm run type-check      # Types (src, scripts)
npm run check           # Type-check, lint, knip
npm run build           # Compile to dist/
npm start               # Run dist/main.js (build first)
npm run smoke           # Import the built app (ESM check)
npm run mtproto:login   # Mint TELEGRAM_SESSION
```

CI runs `verify`, `test:coverage`, `build`, `smoke` and `docker build`. Engineering rules:
[`ADR.md`](ADR.md), summed up in [`CLAUDE.md`](CLAUDE.md).

### Project structure

```
src/
├── main.ts          # Entry point: config, clients, process signals
├── app.ts           # Wiring, start, stop
├── config/          # One zod schema over env, readEnv
├── commands/        # Registry (routing, admin guard, menus, /help), public, training, quiz, status
├── training/        # Seasons, schedule, announcer, attendance, markers, history lookups
│   └── messages/    # Templates, LLM prompts and writer
├── quiz/            # Rules quiz: service, publisher, picker, post, answer, stats, history lookups
│   └── data/        # Question bank
├── telegram/        # Sender, Bot API helpers, MTProto client and history
├── health/          # Health server
└── shared/          # Domain-free helpers: time, formatting, logger, async, emojis
scripts/             # mtproto:login, smoke
assets/signals/      # Hand-signal images
```

A feature folder owns its types. `shared/` imports no feature (lint). Files are camelCase.

## Glossary

One word per concept, one concept per word, in code, logs and docs.

| Term | Meaning | Not |
|---|---|---|
| dot | The product: this bot | "Ultimate Frisbee Training Bot", `ultimate-frisbee-bot` |
| Training | One practice: start, location, season | "practice day", "training info" |
| Announcement | Team-chat post 24h before; its 👍 count is the attendance | "poll", "scheduled message", "reminder", "team message" |
| Key request | Who brings the hall key | "key message" |
| Trainer request | Trainer-chat post asking who coaches | "trainer check message" |
| Attendance reminder | Reply to the announcement when below threshold | "reminder" alone |
| Cancellation notice | Trainer-chat post when still below threshold | "cancellation message" |
| Quiz question / answer | Rules quiz. "Poll" only means a Telegram poll | "rule" in command names |
| Team / trainer / rules / admin chat | A `ChatTarget` (chat id + optional topic) | bare `chatId` |

### Voice

Every text the bot sends, LLM prompts included:

- Short: one idea per line, facts first, no filler.
- Friendly, like a teammate: plain English, never corporate, pushy or guilt-tripping.
- Glossary words, so a post, a command reply and an error say the same thing the same way.

## Troubleshooting

**Bot exits right after starting:**
- The log names every invalid variable: fix `.env`
- "Telegram polling stopped": wrong token, or another instance polls with the same token

**Messages not sent:**
- Chat ids correct (negative for groups), bot a member; in a channel, the bot must be admin
- Admin chat: failed scheduled posts are reported there

**No attendance reminder / cancellation notice:**
- `/status`: MTProto up? checks armed?
- Startup log: an error per chat the MTProto account cannot see; the account must be a member
- `/attendance`: is the announcement found, what is the count?

**LLM posts look like templates:**
- `OLLAMA_ENABLED=true`, `/health/ollama` ok
- Ollama running: `docker logs frisbee-ollama`
- Templates are the fallback when the LLM fails or is too slow
