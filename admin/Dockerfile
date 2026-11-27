# Builds static files only. Caddy serves them (infra/caddy/Caddyfile).
FROM node:22.23.5-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM caddy:2.10.2-alpine
COPY --from=build /app/dist /srv/admin
