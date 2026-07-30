# ─── Stage 1: Builder ────────────────────────────────────────────────────────
# Build tools needed for argon2 native compilation and Prisma generation
FROM node:22-alpine AS builder

# Build dependencies for native modules (argon2)
RUN apk add --no-cache python3 make g++ libc-dev

WORKDIR /build

# Copy package files first (Docker layer cache optimization)
COPY package.json package-lock.json .npmrc ./

# Install ALL dependencies (including devDependencies for Prisma CLI)
RUN npm ci --include=dev

# Copy Prisma schema and generate client BEFORE app code
# This avoids regenerating on every source change
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy rest of application
COPY . .

# ─── Stage 2: Production ─────────────────────────────────────────────────────
# Final image — only production runtime, no build tools
FROM node:22-alpine AS production

# Runtime dependencies only
# chromium: for Puppeteer PDF generation
# tini: proper PID 1 signal handling in containers
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tini \
    dumb-init

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROMIUM_FLAGS="--disable-software-rasterizer --disable-dev-shm-usage"

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S alertmind && \
    adduser -S alertmind -u 1001 -G alertmind

# Copy node_modules from builder (includes compiled argon2 binary)
COPY --from=builder --chown=alertmind:alertmind /build/node_modules ./node_modules

# Copy Prisma generated client
COPY --from=builder --chown=alertmind:alertmind /build/node_modules/.prisma ./node_modules/.prisma

# Copy application files
COPY --chown=alertmind:alertmind . .

# Create required runtime directories
RUN mkdir -p \
    storage/uploads \
    storage/exports \
    storage/reports \
    storage/temp \
    storage/cache \
    logs \
    && chown -R alertmind:alertmind storage logs

# Remove files that should never be in the image
RUN rm -rf \
    .env \
    .env.* \
    tests/ \
    docs/ \
    *.sh \
    .github/

# Run as non-root
USER alertmind

# Expose HTTP port (metrics port 9090 is internal only)
EXPOSE 3000

# Health check using the /api/health/live endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/health/live || exit 1

# Use tini for proper signal handling (ensures graceful shutdown works)
ENTRYPOINT ["/sbin/tini", "--"]

# Run database migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
