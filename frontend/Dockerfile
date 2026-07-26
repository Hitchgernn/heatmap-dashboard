# syntax=docker/dockerfile:1

# Borobudur dashboard frontend.
#
# Vite produces static files, so the runtime image is just nginx. That same
# nginx also proxies /api to the backend container (see nginx.conf), which is
# what makes the deployment same-origin.

# --- build -------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Empty base URL means the client calls /api/... on whatever origin served the
# page. It must be empty rather than "/api": the request paths in lib/api.ts
# already begin with /api, so a "/api" base would produce /api/api/...
#
# Vite inlines this at BUILD time, so it cannot be changed by restarting the
# container — a different value requires a rebuild.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- runtime -----------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/index.html >/dev/null 2>&1 || exit 1
