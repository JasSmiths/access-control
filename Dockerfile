# syntax=docker/dockerfile:1.7
# Multi-stage build for Next.js 16 with better-sqlite3 (native addon) and pdfkit.

FROM node:22-slim AS base
WORKDIR /app
# Packages required to build better-sqlite3 from source.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ---------- deps stage ----------
FROM base AS deps
COPY package.json package-lock.json ./
# Install all deps (including dev) so we can build. Audit/fund noise stripped.
RUN npm ci --no-audit --no-fund

# ---------- build stage ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runtime stage ----------
FROM node:22-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Non-root user
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Copy the standalone output + static assets + public assets.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Migration runner + SQL files
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/migrations ./migrations
# node_modules needed for the migrate script (better-sqlite3)
COPY --from=build --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=build --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Writable data dir (bind-mount target at runtime)
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

# Run migrations then start Next.js standalone server.
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
