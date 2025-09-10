# Build stage
FROM node:20-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./

# Copy all packages
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm run build

# Runtime stage
FROM node:20-alpine

RUN corepack enable

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/patterns', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the orchestrator
CMD ["pnpm", "-C", "packages/n8n-ai-orchestrator", "start"]