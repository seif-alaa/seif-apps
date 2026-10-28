# Single image: the Node game server also serves the built web client.
# Build:  docker build -t pulse-arena .
# Run:    docker run -p 8787:8787 -e SESSION_SECRET=... -e CORS_ORIGINS=https://your.domain pulse-arena

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/server apps/server
COPY apps/client apps/client
RUN npm run build -w @pulse/client && npm run build -w @pulse/server

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=8787 STATIC_DIR=/app/public
WORKDIR /app
# Only the server's runtime dependencies are installed in the final image.
COPY apps/server/package.json ./package.json
# Workspace packages are already bundled into dist/index.js, so drop them before installing.
RUN npm pkg delete dependencies.@pulse/engine dependencies.@pulse/protocol devDependencies \
    && npm install --omit=dev --ignore-scripts --no-package-lock
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/client/dist ./public
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "dist/index.js"]
