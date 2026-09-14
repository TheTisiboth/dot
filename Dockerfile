ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app

# gramjs depends on bufferutil/utf-8-validate, native modules whose prebuilt binaries are glibc-only,
# so on musl they are compiled from source. The toolchain stays in this stage and is never shipped.
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM deps AS prod-deps
RUN npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production

COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node
EXPOSE 3004
CMD ["node", "dist/app.js"]
