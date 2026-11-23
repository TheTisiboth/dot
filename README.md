# Ultimate Frisbee Training Bot 🥏

![Status](https://status.leojan.fr/api/badge/3/status) ![Uptime](https://status.leojan.fr/api/badge/3/uptime/24)

[Monitoring status page](https://status.leojan.fr/status/bot)

A TypeScript Telegram bot that automatically sends training reminders based on seasonal schedules.

## Features

- 🗓️ Seasonal scheduling (winter/summer)
- 🤖 AI-generated messages (optional)
- 👥 Separate messages for team and trainers
- 👍 Attendance tracking from 👍 reactions, with automatic reminder and cancellation
- 🔑 Key-holder message asking who brings the sports hall key
- ⚙️ Fully configurable via environment variables

## Attendance tracking

The training post is the poll: people react 👍 to confirm. The bot then counts those
reactions and acts twice before each training:

| When | If 👍 count is below the threshold | Sent to |
|---|---|---|
| `REMINDER_HOURS_BEFORE` (default 3h) | Posts a reminder to react | Team chat, as a reply to the post |
| `CANCEL_HOURS_BEFORE` (default 1h) | Posts "training should be cancelled" | Trainer chat |

Each is skipped if the count is at or above `WINTER_MIN_ATTENDANCE` / `SUMMER_MIN_ATTENDANCE`.
Only 👍 counts — 👎 is ignored. Admins can check the live count anytime with `/attendance`.

> **Why a user account is required.** The Telegram **Bot API cannot read reactions**. Both
> reaction-read methods (`messages.getMessagesReactions`, `messages.getMessageReactionsList`)
> are documented *"Only users can use this method"*. So the bot writes the messages, and a
> separate MTProto client, logged in as **your own Telegram account**, reads the counts.
> Setup is in [MTProto setup](#mtproto-setup-required-for-attendance) below.

## Quick Start

### 1. Prerequisites

- Node.js at the `NODE_VERSION` in `Dockerfile` (for local setup)
- Docker & Docker Compose (for deployment)
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### 2. Get Your Chat IDs

1. Start a chat with your bot and send a message
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find `"chat":{"id":123456789}` (negative for groups)

### 3. Configuration

```bash
cp .env.example .env
# Edit .env with your settings
```

Required settings in `.env`:
```env
TELEGRAM_BOT_TOKEN=your_token
TEAM_CHAT_ID=team_chat_id
ADMIN_CHAT_ID=your_admin_id
TRAINER_CHAT_ID=trainer_chat_id

WINTER_PRACTICE_DAYS=2:20:30,6:21:00     # Tuesday 20:30, Saturday 21:00
SUMMER_PRACTICE_DAYS=0:19:00,3:19:30     # Sunday 19:00, Wednesday 19:30
```

Optional thread support:
```env
TEAM_CHAT_THREAD_ID=123                   # Team chat thread
TRAINER_CHAT_THREAD_ID=456                # Trainer chat thread
```

### 4. MTProto setup (required for attendance)

Reading reactions is impossible with a bot token, so the bot also logs in as **your own
Telegram account** to read them. Three values are needed.

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

Your account must be a **member of both** `TEAM_CHAT_ID` and `TRAINER_CHAT_ID`: it reads reactions
in the first, and checks for already-sent cancellations in the second. Reactions must be
enabled in the team group with 👍 available.

### 5. Run

**Production:** Dokploy redeploys on every push to `main`.

**Docker, locally** (bot + Ollama, pulls the model):
```bash
npm run docker:up
```

**Local development:**
```bash
npm install
npm run dev
```

## Configuration

### Season Settings

```env
# Winter (default: Sept 15 - May 19)
WINTER_START_DATE=9:15
WINTER_LOCATION=Park Arena
WINTER_PRACTICE_DAYS=2:20:30,6:21:00
WINTER_THROWING_MINUTES_BEFORE=15       # Optional: throwing session shown in the team post, 0 = none

# Summer (default: May 20 - Sept 14)
SUMMER_START_DATE=5:20
SUMMER_LOCATION=Beach Courts
SUMMER_PRACTICE_DAYS=0:19:00,3:19:30
SUMMER_THROWING_MINUTES_BEFORE=0
```

Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

### Attendance Settings

```env
WINTER_MIN_ATTENDANCE=8      # 👍 needed on the training post, else remind then cancel
SUMMER_MIN_ATTENDANCE=8
REMINDER_HOURS_BEFORE=3      # Remind the team this many hours before training
CANCEL_HOURS_BEFORE=1        # Notify trainers to cancel this many hours before training
```

`CANCEL_HOURS_BEFORE` must be smaller than `REMINDER_HOURS_BEFORE` (the cancellation comes
after the reminder); the bot refuses to start otherwise.

### Key-holder Message

Right after the training post, the bot sends a separate message to the team chat asking key
holders to react: 👍 = I have the key and I'm coming, 😢 = I have the key but can't come.

```env
WINTER_KEY_MESSAGE_ENABLED=true   # default: true
SUMMER_KEY_MESSAGE_ENABLED=true   # default: true
```

With Ollama enabled the text is LLM-generated, but it falls back to the template if the output
drifts (wrong, missing or swapped emojis, no mention of the key). The bot adds a 🔑 marker itself,
which keeps this message from being mistaken for the training post after a restart.

### Exceptional Training

Moves or cancels training without touching the season settings:

```env
EXCEPTIONAL_LOCATION=Beach     # replaces the season location
EXCEPTIONAL_TIME=18:30         # replaces the practice start time
EXCEPTIONAL_CANCELLED=true     # sends nothing to team or trainers
```

The announcement still goes out 24h before the regular time, quoting the new place and time;
reminder and cancellation checks count from the new start. A cancelled training gets no
announcement, key or trainer request, no checks and no notice; `/training` says it is cancelled.
The rules quiz still goes out. An override applies to **every** training until it is removed from
`.env` and the service redeployed.

### AI Messages (Optional)

Enable Ollama for AI-generated messages:
```env
OLLAMA_ENABLED=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

## Commands

**Everyone:**
- `/start` - Show welcome message
- `/help` - List commands
- `/info` - Show training schedule
- `/training` - Show next training

**Admin only (preview commands):**
- `/test_template` - Preview template message
- `/test_llm` - Preview LLM team message
- `/test_trainer` - Preview LLM trainer message
- `/test_key` - Preview LLM key-holder message
- `/preview_team` - Preview team message (template or LLM)
- `/preview_all` - Preview team, key-holder and trainer messages

**Admin only (send commands):**
- `/send_to_team` - Send message to team chat
- `/send_to_all` - Send messages to team and trainer chats

**Admin only (attendance):**
- `/attendance` - Live 👍 count on the current training post, vs the season threshold

**Admin only (rules quiz):**
- `/test_rule [id]` - Preview a question and its answer here
- `/send_rule` - Post the next question to the rules chat
- `/answer_rule` - Answer the latest poll in the rules chat

See [Rules quiz](#rules-quiz).

## Health Monitoring

Bot exposes health endpoints on port 3004. Each dependency is `ok`, `disabled` or `down`; probes time out after 5s.

- **`GET /health`** - "the bot works": 503 only when Telegram is down (MTProto and Ollama are optional, templates are the LLM fallback)
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
- **`GET /health/telegram`**, **`/health/mtproto`**, **`/health/ollama`** - one dependency, 503 when it is not `ok` (Ollama disabled included)
  ```json
  { "name": "ollama", "status": "down", "responseTimeMs": 5001, "error": "Ollama did not answer within 5000ms", "timestamp": "..." }
  ```

MTProto status is the reader's connection state (no request); it reconnects on the next attendance check.

**Uptime-kuma setup:**
```yaml
Bot monitor:
  Type: HTTP(s)
  URL: http://frisbee-bot:3004/health
  Interval: 60s

Ollama monitor:
  Type: HTTP(s)
  URL: http://frisbee-bot:3004/health/ollama
  Interval: 60s
```

## Message Flow

The bot sends **three separate messages** 24h before each training:
1. **Team message** → `TEAM_CHAT_ID` (optional thread: `TEAM_CHAT_THREAD_ID`)
2. **Key-holder message** → `TEAM_CHAT_ID`, right after the team message (per-season toggle)
3. **Trainer message** → `TRAINER_CHAT_ID` (optional thread: `TRAINER_CHAT_THREAD_ID`)

All messages can be:
- **Template**: Simple, consistent format
- **AI-generated**: Varied, engaging (requires Ollama)

## Rules quiz

With each training post (the day before training), the bot posts a quiz poll on the rules of
Ultimate to the rules chat. Voters see the right option as soon as they vote. After
`RULES_ANSWER_DELAY_MINUTES`, the bot replies with the answer, explanation and rule link,
hidden behind a spoiler. The quiz goes out even if training is cancelled.

Questions match the season. In winter, only questions that hold indoors (EUF) are picked;
in summer, only those that hold outdoors. The least-asked questions come first, counted from
the rules chat history. The difficulty changes from one quiz to the next when possible.

### Configuration

```env
RULES_QUIZ_ENABLED=false
RULES_CHAT_ID=                    # Group/channel ID (starts with -100), not a private chat
RULES_CHAT_THREAD_ID=             # Optional: topic ID
RULES_ANSWER_DELAY_MINUTES=60     # Minutes between the poll and its answer
RULES_SIGNALS_EVERY_OTHER=false   # Every other quiz is a hand signal (50%), else full random
```

The bot must be able to post in `RULES_CHAT_ID`. The MTProto account
([setup](#4-mtproto-setup-required-for-attendance)) must be a member, because it reads the
history to know which questions were already asked.

Admin commands:
- `/test_rule [id]` - Preview a question and its answer in the current chat. Without an id, it
  picks the way the scheduler would. Nothing is posted to the rules chat.
- `/send_rule` - Post the next question to the rules chat now
- `/answer_rule` - Answer the latest unanswered poll in the rules chat now

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
`/test_rule <id>`.

Hand-signal images in `assets/signals/` are cropped from the WFDF Hand Signals PDF.

**Sources and licence.** Questions are adapted from the
[WFDF Rules of Ultimate 2025-2028](https://rules.wfdf.sport/) and related WFDF rules
documents, © World Flying Disc Federation, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Indoor questions are adapted
from the [EUF Indoor Rules Appendix](https://www.ultimatefederation.eu/rules-of-ultimate).

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

## Development

```bash
npm run dev             # Watch mode
npm run verify          # Type-check, lint + format, knip, tests (run before every push; CI also builds + docker build)
npm test                # Run tests
npm run test:coverage   # Tests with coverage thresholds
npm run lint            # Check code quality and formatting
npm run format          # Fix lint + formatting
npm run type-check      # Check types
npm run build           # Compile to dist/
npm start               # Run dist/main.js (build first)
npm run smoke           # Import the built app (ESM check)
```

Release: on `main`, after a user-visible change ships, `npm run release -- patch|minor|major` (bumps `version`, commits, tags `vX.Y.Z`), then `git push --follow-tags`.

## Project Structure

```
src/
├── main.ts                     # Entry point: config, clients, process signals
├── app.ts                      # Wiring, start, stop
├── config/                     # One zod schema over env, readEnv
├── commands/                   # Registry (routing, admin guard, menus), public, training, quiz
├── training/                   # Seasons and trainings, scheduler, markers
│   └── messages/               # Message generator (templates, LLM)
├── quiz/                       # Rules quiz: service (when), publisher (sends), picker, post, answer, tag, question types
│   └── data/                   # Question bank
├── telegram/                   # Bot API helpers, MTProto history reader
├── health/                     # Health server
└── shared/                     # Domain-free helpers: time, formatting, logger, async, emojis
```

A feature folder owns its types. `shared/` imports no feature (lint). Files are camelCase.

## Troubleshooting

**Bot not responding:**
- Check bot token is correct
- Verify bot isn't already running

**Messages not sending:**
- Confirm chat IDs are correct (negative for groups)
- Ensure bot is in the group/channel
- For channels, bot must be admin

**AI messages failing:**
- Check `OLLAMA_ENABLED=true`
- Verify Ollama is running: `docker logs frisbee-ollama`
- Bot falls back to templates if AI fails
