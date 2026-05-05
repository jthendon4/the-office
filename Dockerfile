# The Office — production image.
# Two-stage build so the final image is small.

FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Native build deps for better-sqlite3.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# --- Runtime image ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# better-sqlite3 needs to be rebuilt against the runtime architecture.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist

# Persistent volume mount point on Railway.
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "dist/index.cjs"]
