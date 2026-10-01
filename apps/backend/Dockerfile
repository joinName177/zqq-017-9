# Multi-stage Dockerfile for Backend (Node.js 20 Alpine)
FROM node:20-alpine AS builder

WORKDIR /workspace

# Use fast Alpine mirror
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories

# Install native compilation dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Configure fast npm mirror and install pnpm
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@12.4.1 && \
    pnpm config set registry https://registry.npmmirror.com

# Copy workspace configuration and packages
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

# Install dependencies and approve native build scripts
RUN pnpm install --filter=@anxiety-entropy/backend... && (pnpm approve-builds --all || true)

# Build shared and backend packages
RUN pnpm --filter=@anxiety-entropy/shared build
RUN pnpm --filter=@anxiety-entropy/backend build

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /workspace

# Use fast Alpine mirror & install curl for healthcheck
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories && \
    apk add --no-cache curl

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DB_PATH=/app/data/anxiety-entropy.db

# Create data directory for SQLite persistence
RUN mkdir -p /app/data

# Copy built artifacts and node_modules from builder
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/package.json ./package.json
COPY --from=builder /workspace/packages/shared ./packages/shared
COPY --from=builder /workspace/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=builder /workspace/apps/backend/node_modules ./apps/backend/node_modules

EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "apps/backend/dist/main.js"]
