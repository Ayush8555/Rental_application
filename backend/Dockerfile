# syntax=docker/dockerfile:1.7
FROM node:26.13.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts && npx prisma generate
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && cp -r src/public-pages/static dist/public-pages/static && npm prune --omit=dev --ignore-scripts

FROM node:26.13.0-bookworm-slim
ENV NODE_ENV=production TZ=Asia/Kolkata
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-core tini && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts /app/package.json ./
USER node
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
