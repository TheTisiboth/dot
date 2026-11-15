# Only place to bump Node: CI reads it, test/node-version.test.ts ties @types/node to it
ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-alpine AS builder

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

# Build the application, then drop dev dependencies so production reuses the compiled native modules
RUN npm run build \
    && npm prune --omit=dev

# Production stage
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
# Rules quiz hand-signal images, sent as photos
COPY --from=builder /app/assets ./assets

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

USER nodejs

# Health server port
EXPOSE 3004

# Start the application
CMD ["node", "dist/app.js"]