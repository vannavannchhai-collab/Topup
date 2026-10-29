# NOVA API service — container image for Vercel (`services.api.runtime = "container"`).
#
# Build context is `server/` (the service root), so dependencies are installed
# from server/package.json alone rather than the workspace root lockfile.
# `node:sqlite` is a Node 22 builtin that still needs `--experimental-sqlite`,
# which is why the API runs as a container instead of a framework preset.

# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

RUN npm prune --omit=dev

# ─── Runtime stage ───────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/tmp/nova.db

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN chown -R node:node /app
USER node
EXPOSE 3000

# Vercel injects PORT; our server reads it (see server/src/config.ts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-sqlite", "--no-warnings=ExperimentalWarning", "dist/index.js"]
