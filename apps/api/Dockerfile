# ResiliPlan API — Multi-stage build
# Stage 1: Build with all deps
# Stage 2: Production runtime (minimal image)

# ===== Stage 1: Build =====
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare [email protected] --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies (with frozen lockfile if available)
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build shared package
RUN pnpm --filter @resiliplan/shared run build || true

# Build API
RUN pnpm --filter @resiliplan/api run build

# Prune dev dependencies
RUN pnpm --filter @resiliplan/api deploy --prod /app/api-prod || \
    (cd apps/api && pnpm prune --prod)

# ===== Stage 2: Production =====
FROM node:20-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init wget

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S resiliplan -u 1001

WORKDIR /app

# Copy built artifacts
COPY --from=builder --chown=resiliplan:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=resiliplan:nodejs /app/apps/api/node_modules ./node_modules
COPY --from=builder --chown=resiliplan:nodejs /app/apps/api/package.json ./

# Switch to non-root user
USER resiliplan

# Environment
ENV NODE_ENV=production
ENV API_PORT=3001
ENV API_HOST=0.0.0.0

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health/live || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start
CMD ["node", "dist/server.js"]
