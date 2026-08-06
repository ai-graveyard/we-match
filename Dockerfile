# 自部署镜像：pnpm build + next start，SQLite 数据放 /app/data（挂持久化卷）
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node
EXPOSE 3000
VOLUME /app/data
CMD ["pnpm", "start"]
