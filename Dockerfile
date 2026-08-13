# COMMAND runs on SQLite, so it needs a real filesystem that survives a restart.
# This image is meant for a host with a persistent volume mounted at /data —
# Render, Railway, Fly, or any VPS. It will not work on serverless hosting.

FROM node:22-bookworm-slim

# better-sqlite3 is a native addon and compiles during install.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dev dependencies are kept in the final image on purpose: the build needs
# TypeScript and Tailwind, and first boot needs tsx to run the seed.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV COMMAND_DB_PATH=/data/command.db
ENV PORT=3000

EXPOSE 3000

CMD ["node", "scripts/boot.mjs"]
