# Dot - Seasonal Telegram Dog Care Bot 🐕

A Telegram bot that sends seasonal dog care reminders on configured days and times. The bot automatically switches between winter and summer schedules based on the current date.

## Features

- 🗓️ **Seasonal Scheduling**: Automatically switches between winter and summer schedules
- ⏰ **Flexible Timing**: Configure different days and times for each season
- 📱 **Telegram Integration**: Sends messages to specified Telegram channels/groups
- 🔧 **Easy Configuration**: Environment-based configuration
- 📊 **Bot Commands**: Interactive commands for status and testing

## Quick Start

### 1. Prerequisites

- Node.js (v14 or higher)
- A Telegram bot token (get from [@BotFather](https://t.me/BotFather))
- The chat ID of your target channel/group

### 2. Installation

```bash
git clone <repository-url>
cd dot
npm install
```

### 3. Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
BOT_TOKEN=your_bot_token_from_botfather
CHAT_ID=your_telegram_chat_id

# Seasonal start dates (YYYY-MM-DD format)
WINTER_START_DATE=2024-12-01
SUMMER_START_DATE=2024-06-01

# Schedule format: day_of_week hour:minute
# Day of week: 0=Sunday, 1=Monday, 2=Tuesday, etc.
WINTER_DAY_1=1 09:00
WINTER_DAY_2=4 14:30
SUMMER_DAY_1=2 08:00
SUMMER_DAY_2=5 16:00

# Custom message templates
WINTER_MESSAGE_TEMPLATE="🐕 Winter reminder: Don't forget to take care of your furry friend in cold weather! ❄️"
SUMMER_MESSAGE_TEMPLATE="🐕 Summer reminder: Keep your dog hydrated and cool in the hot weather! ☀️"
```

### 4. Getting Your Chat ID

To find your chat ID:

1. Add your bot to the desired channel/group
2. Send a message mentioning the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for the `chat.id` value in the response

### 5. Running the Bot

```bash
# Test configuration
npm test

# Start the bot
npm start
```

## Bot Commands

Once the bot is running, you can use these commands:

- `/start` - Initialize the bot
- `/status` - Show current season and schedule
- `/test` - Send a test message to the configured channel
- `/help` - Show available commands

## Configuration Options

### Seasonal Scheduling

The bot supports two seasons with configurable start dates:

- **Winter Season**: Starts on `WINTER_START_DATE`
- **Summer Season**: Starts on `SUMMER_START_DATE`

Each season can have up to 2 scheduled message times per week (easily extendable).

### Message Templates

You can customize the message templates for each season using the environment variables:

- `WINTER_MESSAGE_TEMPLATE`
- `SUMMER_MESSAGE_TEMPLATE`

### Time Format

Schedule times use the format: `day_of_week hour:minute`

- `day_of_week`: 0-6 (0=Sunday, 1=Monday, ..., 6=Saturday)
- `hour:minute`: 24-hour format (e.g., 09:00, 14:30)

## Architecture

The bot consists of several modules:

- **`index.js`**: Main entry point with graceful shutdown handling
- **`bot.js`**: Telegram bot logic and scheduling
- **`seasonManager.js`**: Season detection and schedule management
- **`config.js`**: Configuration management and validation
- **`test.js`**: Configuration and logic testing

## Future Enhancements

- 🤖 **LLM Integration**: Generate dynamic messages using AI prompts
- 📊 **Analytics**: Track message delivery and engagement
- 🌍 **Timezone Support**: Handle different timezones
- 📝 **Dynamic Templates**: Web interface for message template management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - see LICENSE file for details.
