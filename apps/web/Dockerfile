FROM node:20-alpine AS builder

WORKDIR /app

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
