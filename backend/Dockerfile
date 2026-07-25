# syntax=docker/dockerfile:1

# Borobudur dashboard backend.
#
# Two stages so the runtime image carries no compiler and no devDependencies.
# Location data comes from Hyperbase over REST and admin auth from PostgreSQL,
# so the image itself is stateless — everything it needs arrives via env vars.

# --- build -------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime -----------------------------------------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist

# tsc emits only JavaScript, so schema.sql is not carried into dist/ by the
# build. db/init.ts reads it at runtime with readFileSync(__dirname/schema.sql),
# so `node dist/db/init.js` fails with ENOENT without this line.
COPY --chown=node:node src/db/schema.sql ./dist/db/schema.sql

USER node

EXPOSE 3001

# Matches the /health route mounted outside /api, so the probe needs no session.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
