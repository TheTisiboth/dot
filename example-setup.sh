#!/bin/bash

# Example setup script for the Telegram Bot
# This script helps users set up the bot quickly

echo "🐕 Dot - Telegram Bot Setup Script"
echo "=================================="
echo

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Please edit it manually or remove it to run this script."
    exit 1
fi

# Copy the example environment file
echo "📋 Copying .env.example to .env..."
cp .env.example .env

echo "✅ Created .env file!"
echo
echo "📝 Next steps:"
echo "1. Edit the .env file with your bot credentials:"
echo "   - Get BOT_TOKEN from @BotFather on Telegram"
echo "   - Get CHAT_ID from your target channel/group"
echo
echo "2. Test your configuration:"
echo "   npm test"
echo
echo "3. Start the bot:"
echo "   npm start"
echo
echo "4. Or run with Docker:"
echo "   docker-compose up -d"
echo
echo "🔧 Configuration file location: $(pwd)/.env"
echo "📖 Full documentation: README.md"