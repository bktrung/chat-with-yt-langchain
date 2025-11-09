# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat dumb-init && \
    addgroup -g 1001 -S ytchat && \
    adduser -S ytchat -u 1001

COPY --from=deps --chown=ytchat:ytchat /app/node_modules ./node_modules
COPY --from=build --chown=ytchat:ytchat /app/dist ./dist
COPY --chown=ytchat:ytchat package*.json ./

USER ytchat
ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]
