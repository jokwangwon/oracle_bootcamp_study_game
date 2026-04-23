FROM node:20-alpine AS builder

WORKDIR /app

# Next.js 는 NEXT_PUBLIC_* 을 **빌드 타임 replacement** 하므로 build args 로 주입.
# 미지정 시 localhost 기본값으로 빌드 → tailscale/외부 접속 시 API 호출 실패.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY package.json package-lock.json* turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npx turbo run build --filter=@oracle-game/web

FROM node:20-alpine AS runtime

WORKDIR /app/apps/web

ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./
COPY --from=builder /app/node_modules /app/node_modules

EXPOSE 3000

CMD ["npm", "start"]
