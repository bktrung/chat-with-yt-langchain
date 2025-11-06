# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm ci --omit=dev
RUN npm install -g drizzle-kit
COPY --from=build /app/dist ./dist
COPY drizzle.config.ts ./drizzle.config.ts
COPY src/database ./src/database
ENV NODE_ENV=production
RUN mkdir -p logs
EXPOSE 3000
CMD ["sh", "-c", "drizzle-kit push && node dist/src/main"]
