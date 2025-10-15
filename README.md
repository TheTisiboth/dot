# Ultimate Frisbee Training Bot 🥏

A TypeScript Telegram bot that automatically sends training reminders based on seasonal schedules.

## Features

- 🗓️ Seasonal scheduling (winter/summer)
- 🤖 AI-generated messages (optional)
- 👥 Separate messages for team and trainers
- ⚙️ Fully configurable via environment variables

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

### 4. Run

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