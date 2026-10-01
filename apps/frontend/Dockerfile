# Multi-stage Dockerfile for Frontend (Node.js 20 Alpine -> Nginx Alpine)
FROM node:20-alpine AS builder

WORKDIR /workspace

# Use fast Alpine mirror
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories

# Configure fast npm mirror and install pnpm
RUN npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@12.4.1 && \
    pnpm config set registry https://registry.npmmirror.com

# Copy workspace manifests and packages
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

# Install dependencies and build
RUN pnpm install --filter=@anxiety-entropy/frontend... && (pnpm approve-builds --all || true)

# Build shared and frontend assets
RUN pnpm --filter=@anxiety-entropy/shared build
RUN pnpm --filter=@anxiety-entropy/frontend build

# Production Web Server
FROM nginx:alpine AS runner

# Replace default nginx config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA static assets
COPY --from=builder /workspace/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
