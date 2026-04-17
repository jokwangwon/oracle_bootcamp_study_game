FROM node:20-alpine AS builder

WORKDIR /app

# 워크스페이스 매니페스트만 먼저 복사 (캐시 활용)
COPY package.json package-lock.json* turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

# 소스 복사 후 빌드
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npx turbo run build --filter=@oracle-game/api

# --- Runtime stage ---
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/main.js"]
