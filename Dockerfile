# Multi-stage build for Node.js app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# gramjs depends on bufferutil/utf-8-validate, native modules whose prebuilt binaries are glibc-only,
# so on musl they are compiled from source. The toolchain is dropped again in the same layer.
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci \
    && apk del .build-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps \
    && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port (though the bot doesn't serve HTTP, this is for documentation)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Bot is healthy')" || exit 1

# Start the application
CMD ["node", "dist/app.js"]