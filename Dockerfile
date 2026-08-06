# 自部署镜像：pnpm build + next start，SQLite 数据放 /app/data（挂持久化卷）
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
# better-sqlite3 是原生模块，装依赖时要从源码编译，需要 Python + 编译工具链。
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# 服务器和别的项目共用，不能用全局 docker image prune 清理悬空镜像；
# 打上这个标签，Makefile 的 deploy 就能只清自己的（必须打在最终阶段）。
LABEL com.ai-graveyard.project=we-match
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
