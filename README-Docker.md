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

# Deploy all services (stops and rebuilds everything)
npm run docker:deploy

# Deploy only bot (keeps Ollama running, updates bot only)
npm run docker:deploy:bot
```

## 🏗️ Architecture

- **frisbee-bot**: Your TypeScript bot
- **ollama**: Local LLM server with llama3.2:3b (configurable)
- **ollama-setup**: One-time model downloader

## 🔧 Configuration

The bot automatically connects to Ollama at `http://ollama:11434` inside the container network.

### Environment Variables

You can customize the Ollama configuration:

```env
OLLAMA_MODEL=llama3.2:3b              # Default model
OLLAMA_MEMORY_LIMIT=5G                 # Maximum memory allocation
OLLAMA_MEMORY_RESERVATION=4G           # Reserved memory
```

## 📊 Monitoring

- Bot status: `docker-compose ps`
- Bot logs: `npm run docker:logs`
- Ollama health: `curl http://localhost:11434/api/tags`
- Check Ollama memory: `docker inspect frisbee-ollama --format '{{.HostConfig.Memory}}'`
- List downloaded models: `docker exec frisbee-ollama ollama list`

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
- ~5GB RAM for llama3.2:3b (configurable)
- ~2GB disk space for model

## 🔄 Updating the Bot

When you make changes to your bot code, use `npm run docker:deploy:bot` to update only the bot container without affecting Ollama. This preserves the downloaded model and keeps Ollama running.

```bash
# Make your code changes
npm run docker:deploy:bot
```

**Important**: Don't use `npm run docker:deploy` for routine updates, as it will stop and remove all containers including Ollama, requiring you to re-download the model.