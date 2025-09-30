# Ultimate Frisbee Training Bot 🥏

A modern TypeScript Telegram bot that automatically sends training reminders twice a week based on seasonal schedules. Perfect for Ultimate Frisbee teams with different winter and summer training routines.

## Features

- 🗓️ **Seasonal Scheduling**: Different training days and times for winter and summer seasons
- 🤖 **Smart Messages**: Choose between template messages or AI-generated content
- 🧪 **Testing Tools**: Test messages, date overrides, and manual triggers
- ⚙️ **Configurable**: Easy to customize locations, times, and seasons
- 🔧 **TypeScript**: Full type safety and modern development experience
- 🏗️ **Clean Architecture**: Well-organized, modular, and maintainable codebase

## Quick Start

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Choose a name (e.g., "Ultimate Frisbee Bot")
4. Choose a username (e.g., "your_ultimate_bot")
5. Save the bot token you receive

### 2. Get Your Chat ID

**For testing (private messages):**
1. Start a chat with your bot
2. Send any message to your bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":123456789}` - this is your chat ID

**For groups/channels:**
1. Add your bot to the group/channel
2. Make the bot an admin (for channels)
3. Send a message mentioning the bot: `@your_bot_name hello`
4. Visit the getUpdates URL above
5. Look for the chat ID (will be negative for groups/channels)

### 3. Install and Configure

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

### 4. Configure Environment

Edit `.env` file:

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
CHAT_ID=your_chat_id_here

# Optional: Admin Configuration (for admin-only commands)
ADMIN_CHAT_ID=your_admin_chat_id_here

# Optional: Ollama Configuration (for local LLM-generated messages)
OLLAMA_ENABLED=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_MEMORY_LIMIT=5G                     # Maximum memory for Ollama container
OLLAMA_MEMORY_RESERVATION=4G               # Reserved memory for Ollama container

# Winter Season Configuration
WINTER_START_DATE=9:15                    # Format: month:day (September 15)
WINTER_LOCATION=Park Arena                # Default location for winter training
WINTER_PRACTICE_DAYS=2:20:30,6:21:00     # Format: day:time,day:time (Tuesday 20:30, Saturday 21:00)
WINTER_SCHEDULE_TIME=20:00                # What time to send reminder messages

# Summer Season Configuration
SUMMER_START_DATE=5:20                    # Format: month:day (May 20)
SUMMER_LOCATION=Beach Courts              # Default location for summer training
SUMMER_PRACTICE_DAYS=0:19:00,3:19:30     # Format: day:time,day:time (Sunday 19:00, Wednesday 19:30)
SUMMER_SCHEDULE_TIME=20:00                # What time to send reminder messages

# Testing
TEST_MODE=false
OVERRIDE_DATE=

# Day Reference: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
```

### 5. Run the Bot

```bash
# Build the TypeScript code
npm run build

# Start the bot
npm start

# For development (auto-restart on changes)
npm run dev

# Run tests
npm test

# Type checking and linting
npm run type-check  # TypeScript type checking only
npm run lint        # ESLint code quality checking
npm run check       # Both type checking and linting
```

## Schedule Configuration

### Winter Season (September 15 - May 19)
- **Training Days**: Configurable days with individual times
- **Default**: Tuesdays at 20:30, Saturdays at 20:30
- **Location**: Park Arena (configurable)
- **Messages sent at**: 20:00 (8 PM, configurable)

### Summer Season (May 20 - September 14)
- **Training Days**: Configurable days with individual times
- **Default**: Sundays at 19:00, Wednesdays at 19:00
- **Location**: Beach Courts (configurable)
- **Messages sent at**: 20:00 (8 PM, configurable)

## Bot Commands

### Available to Everyone:
- `/start` - Initialize bot and show help
- `/help` - Display help message
- `/info` - Show current season and schedule information
- `/training` - Show next training date

### Admin Only (requires ADMIN_CHAT_ID):
- `/test_template` - Send a test message using the template
- `/test_llm` - Send a test message using AI generation
- `/send_now` - Manually trigger message sending

## Message Types

### Template Message
```
🚀 Hey team!

Tomorrow we're planning an Ultimate Frisbee training at [LOCATION] starting at [TIME].

💡 If you're in, just drop a 👍 on this message so we know how many are coming.
The more the merrier! 🥏
```

### AI-Generated Messages
When Ollama is enabled, the bot will generate varied, engaging messages using a local LLM (default: llama3.2:3b) while maintaining the same core information and call-to-action.

## Testing

### Test Seasonal Logic
```bash
npm test
```

### Test with Specific Dates
Use the bot command: `/test_season 2024-01-15`

### Test Messages
- `/test_template` - Preview template message
- `/test_llm` - Preview AI-generated message

### Manual Testing
Set environment variables for testing:
```env
TEST_MODE=true
OVERRIDE_DATE=2024-01-15
```

## Advanced Configuration

### Different Times for Different Practice Days

You can now configure different times for each training day using environment variables:

```env
# Winter: Tuesday at 20:30, Saturday at 21:00
WINTER_PRACTICE_DAYS=2:20:30,6:21:00

# Summer: Sunday at 19:00, Wednesday at 19:30
SUMMER_PRACTICE_DAYS=0:19:00,3:19:30
```

### Configurable Season Dates

Set custom season start dates:

```env
# Winter starts October 1st
WINTER_START_DATE=10:1

# Summer starts June 15th
SUMMER_START_DATE=6:15
```

### Custom Reminder Times

Set when daily reminders are sent:

```env
# Send winter reminders at 7:30 PM
WINTER_SCHEDULE_TIME=19:30

# Send summer reminders at 8:30 PM
SUMMER_SCHEDULE_TIME=20:30
```

## Customization (Code Changes)

### Change Training Days (Alternative)
Edit `src/config/index.ts` to modify defaults:
```typescript
practices: [
  { day: 2, time: '20:30' }, // Tuesday 20:30
  { day: 6, time: '21:00' }  // Saturday 21:00
]
```

### Modify Message Templates
Edit the `generateTemplateMessage` function in `src/services/MessageGenerator.ts`

### Adjust LLM Prompts
Edit the prompt in the `generateLLMMessage` function in `src/services/MessageGenerator.ts`

## Deployment

### Docker Deployment (Recommended)

**One-command deployment** that builds and starts everything including Ollama:

```bash
# Deploy bot with Ollama (includes automatic model pull)
npm run docker:deploy
```

This will:
1. Build the TypeScript code
2. Stop any running containers
3. Start Ollama container
4. Start the bot container
5. Automatically pull the LLM model (llama3.2:3b)

**Other Docker commands:**

```bash
# View bot logs
npm run docker:logs

# View Ollama logs
npm run docker:logs:ollama

# Restart just the bot
npm run docker:restart

# Pull/update the Ollama model manually
npm run docker:ollama:pull

# Development mode (with logs)
npm run docker:dev
```

**Requirements:**
- Docker and Docker Compose installed
- At least 4GB RAM available for Ollama

### Local Deployment (Without Docker)

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# If using Ollama, install and start it separately
# See: https://ollama.ai

# Build and start bot
npm run build
npm start
```

### Production Deployment (VPS/Server)

**Option 1: Docker (Recommended)**
```bash
# Clone repository
git clone git@github.com:YourUsername/dot.git
cd dot

# Configure environment
cp .env.example .env
nano .env  # Edit with your settings

# Deploy
npm run docker:deploy
```

**Option 2: PM2 Process Manager**
```bash
npm install -g pm2
npm run build
pm2 start dist/app.js --name ultimate-frisbee-bot
pm2 startup
pm2 save
```

## Troubleshooting

### Bot not receiving messages
- Ensure the bot token is correct
- Check that the bot isn't already running elsewhere
- Verify the bot has necessary permissions

### Messages not being sent
- Check the CHAT_ID is correct (positive for private, negative for groups)
- Ensure the bot is added to the group/channel
- For channels, make sure the bot is an admin

### Scheduling issues
- Check server timezone settings
- Verify cron expression is correct
- Look at console logs for scheduling confirmations

### AI messages not working
- Verify OLLAMA_ENABLED is set to true
- Check Ollama is running at the configured host
- Verify the model is downloaded (use `docker exec frisbee-ollama ollama list`)
- Bot will fall back to template messages if Ollama fails

## Project Structure

```
├── src/
│   ├── app.ts                    # Main application entry point
│   ├── test.ts                   # Test runner entry point
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   ├── config/
│   │   └── index.ts              # Configuration management
│   ├── services/
│   │   ├── SeasonManager.ts      # Seasonal logic and date handling
│   │   ├── MessageGenerator.ts   # Template and AI message generation
│   │   └── SchedulerService.ts   # Cron scheduling service
│   ├── controllers/
│   │   └── BotController.ts      # Telegram bot command handling
│   ├── utils/
│   │   ├── constants.ts          # Application constants
│   │   └── dateHelpers.ts        # Date utility functions
│   └── tests/
│       └── testRunner.ts         # Test suite implementation
├── dist/                         # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .env.example
├── .gitignore
└── README.md
```
