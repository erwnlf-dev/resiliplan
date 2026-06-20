# ResiliPlan Web — Multi-stage build

# ===== Stage 1: Build =====
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare [email protected] --activate

COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile || pnpm install

COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @resiliplan/web run build

# ===== Stage 2: Production (static files via preview server) =====
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S resiliplan -u 1001

WORKDIR /app

COPY --from=builder --chown=resiliplan:nodejs /app/apps/web/dist ./dist
COPY --from=builder --chown=resiliplan:nodejs /app/apps/web/package.json ./

# Install serve for production preview
RUN npm install --no-save serve@14

USER resiliplan

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4173/ || exit 1

# Serve static build with SPA fallback
CMD ["npx", "serve", "-s", "dist", "-l", "4173"]
