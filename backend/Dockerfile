# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY drizzle.config.ts ./drizzle.config.ts
COPY src ./src
RUN npm run build

FROM base AS runner
COPY package.json package-lock.json ./
RUN npm ci
COPY --from=build /app/dist ./dist
COPY tsconfig.json tsconfig.build.json ./
COPY drizzle.config.ts ./drizzle.config.ts
COPY src/database ./src/database
ENV NODE_ENV=production
RUN mkdir -p logs
EXPOSE 3000
CMD ["node", "dist/src/main"]
