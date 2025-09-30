# Docker Setup for Ultimate Frisbee Bot

This setup bundles both the bot and Ollama LLM in containers for easy deployment.

## 🚀 Quick Start

1. **Setup environment**:
   ```bash
   cp .env.docker .env
   # Edit .env and add your TELEGRAM_BOT_TOKEN and CHAT_ID
   ```

2. **Start everything**:
   ```bash
   npm run docker:up
   ```

3. **Wait for model download** (first time only):
   ```bash
   npm run docker:setup
   ```

4. **Check logs**:
   ```bash
   npm run docker:logs
   ```

## 📋 Available Commands

```bash
# Build and start services
npm run docker:up

# Stop all services
npm run docker:down

# View bot logs
npm run docker:logs

# View Ollama logs
npm run docker:logs:ollama

# Restart just the bot
npm run docker:restart

# Pull LLM model (run once)
npm run docker:setup

# Development mode (rebuild + start)
npm run docker:dev
```

## 🏗️ Architecture

- **frisbee-bot**: Your TypeScript bot
- **ollama**: Local LLM server with qwen2:0.5b
- **ollama-setup**: One-time model downloader

## 🔧 Configuration

The bot automatically connects to Ollama at `http://ollama:11434` inside the container network.

## 📊 Monitoring

- Bot status: `docker-compose ps`
- Bot logs: `npm run docker:logs`
- Ollama health: `curl http://localhost:11434/api/tags`

## 💾 Data Persistence

- Ollama models are stored in a Docker volume
- Bot data is ephemeral (logs only)

## 🚀 Production Deployment

For production servers:
1. Copy files to server
2. Set environment variables
3. Run `docker-compose up -d`
4. Models persist across restarts

## ⚠️ Requirements

- Docker & Docker Compose
- ~1GB RAM for qwen2:0.5b
- ~500MB disk space for model