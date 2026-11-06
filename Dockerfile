# Box Populi on Node with a SQLite file (SELF_HOSTING.md "Docker"). Put HTTPS in front of it:
# compose.yaml runs Caddy for that. Sign-in cookies are Secure, so plain http won't work.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN BOX_TARGET=node pnpm build
# Only the runtime dependencies go into the image; the build bundles everything else.
RUN pnpm prune --prod

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATABASE_PATH=/data/box-populi.db
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
CMD ["node", "build"]
