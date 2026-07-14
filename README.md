# Ultimate Frisbee Training Bot 🥏

![Status](https://status.leojan.fr/api/badge/3/status) ![Uptime](https://status.leojan.fr/api/badge/3/uptime/24)

[Monitoring status page](https://status.leojan.fr/status/bot)

A TypeScript Telegram bot that automatically sends training reminders based on seasonal schedules.

## Features

- 🗓️ Seasonal scheduling (winter/summer)
- 🤖 AI-generated messages (optional)
- 👥 Separate messages for team and trainers
- 👍 Attendance tracking from 👍 reactions, with automatic reminder and cancellation
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

- Node.js 18+ (for local setup)
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
CHAT_ID=team_chat_id
ADMIN_CHAT_ID=your_admin_id
TRAINER_CHAT_ID=trainer_chat_id

WINTER_PRACTICE_DAYS=2:20:30,6:21:00     # Tuesday 20:30, Saturday 21:00
SUMMER_PRACTICE_DAYS=0:19:00,3:19:30     # Sunday 19:00, Wednesday 19:30
```

Optional thread support:
```env
CHAT_THREAD_ID=123                        # Team chat thread
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

Your account must be a **member of both** `CHAT_ID` and `TRAINER_CHAT_ID`: it reads reactions
in the first, and checks for already-sent cancellations in the second. Reactions must be
enabled in the team group with 👍 available.

### 5. Run

**Docker (recommended):**
```bash
npm run deploy
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

# Summer (default: May 20 - Sept 14)
SUMMER_START_DATE=5:20
SUMMER_LOCATION=Beach Courts
SUMMER_PRACTICE_DAYS=0:19:00,3:19:30
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
- `/preview_team` - Preview team message (template or LLM)
- `/preview_all` - Preview both team and trainer messages

**Admin only (send commands):**
- `/send_to_team` - Send message to team chat
- `/send_to_all` - Send messages to team and trainer chats

**Admin only (attendance):**
- `/attendance` - Live 👍 count on the current training post, vs the season threshold

## Health Monitoring

Bot exposes health endpoints on port 3004:

- **`GET /health`** - Full health check (Telegram API connectivity)
  - Returns 200 with `{status: 'ok', telegram: 'connected', ollama: 'provider'}`

- **`GET /health/ollama`** - Ollama status only
  - Returns 200 if enabled, 503 if disabled/error

**Uptime-kuma setup:**
```yaml
Bot monitor:
  Type: HTTP(s)
  URL: http://frisbee-bot:3004/health
  Interval: 60s

Ollama monitor:
  Type: HTTP(s)
  URL: http://ollama:11434/api/tags
  Interval: 60s
```

## Docker Commands

```bash
npm run deploy              # Build and deploy everything
npm run bot:logs            # View bot logs
npm run bot:restart         # Restart bot only
npm run ollama:logs         # View Ollama logs
npm run docker:dev          # Run with live logs
```

## Message Flow

The bot sends **two separate messages** 24h before each training:
1. **Team message** → `CHAT_ID` (optional thread: `CHAT_THREAD_ID`)
2. **Trainer message** → `TRAINER_CHAT_ID` (optional thread: `TRAINER_CHAT_THREAD_ID`)

Both messages can be:
- **Template**: Simple, consistent format
- **AI-generated**: Varied, engaging (requires Ollama)

## Development

```bash
npm run dev             # Watch mode
npm test               # Run tests
npm run lint           # Check code quality
npm run type-check     # Check types
```

## Project Structure

```
src/
├── app.ts                      # Entry point
├── config/
│   ├── index.ts               # Config loader
│   └── schema.ts              # Validation schemas
├── controllers/
│   └── BotController.ts       # Command handlers
├── services/
│   ├── SeasonManager.ts       # Season logic
│   ├── MessageGenerator.ts    # Message creation
│   └── SchedulerService.ts    # Cron scheduling
└── utils/                     # Helpers
```

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
