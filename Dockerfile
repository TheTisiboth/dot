# Only place to bump Node: CI reads it, test/nodeVersion.test.ts ties @types/node to it
ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

FROM base AS deps
# gramjs's bufferutil/utf-8-validate have glibc-only prebuilds: compiled from source on musl
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM deps AS build
COPY . .
RUN npm run build

# Reuses the native modules compiled in deps: no second install
FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Rules quiz hand-signal images, sent as photos
COPY --chown=node:node assets ./assets
USER node
# Health server port
EXPOSE 3004
CMD ["node", "dist/main.js"]
