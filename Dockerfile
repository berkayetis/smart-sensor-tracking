FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 1001 --create-home appuser
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
CMD ["sh", "-c", "npm run prisma:deploy && if [ \"${RUN_DB_SEED:-false}\" = \"true\" ]; then echo 'RUN_DB_SEED=true -> running prisma seed'; npm run prisma:seed; else echo 'RUN_DB_SEED is not true -> skipping prisma seed'; fi && npm run start:prod"]
