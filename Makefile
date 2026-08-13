IMAGE = ai-graveyard/we-match
VERSION = latest
# 和 Dockerfile 最终阶段的 LABEL 保持一致，deploy 用它把清理限定在自己的镜像上。
PRUNE_LABEL = com.ai-graveyard.project=we-match

.DEFAULT_GOAL := help

.PHONY: dev build start stop restart logs backup deploy help

dev:
	pnpm dev

build:
	docker build -t $(IMAGE):$(VERSION) .

start:
	docker compose up -d

stop:
	docker compose down

restart: stop start

logs:
	docker compose logs -f

# SQLite 在线备份。脚本必须在运行中的应用容器里执行，才能读取 /app/data 的
# named volume；宿主机仓库下的 ./data 不是生产数据库。
backup:
	docker compose exec -T we-match node scripts/backup-db.mjs /app/backups

# 顺序：拉代码 → 备份数据库 → 构建 → 重启 → 清理。备份在重启前，保证有回滚点。
deploy:
	git pull --ff-only
	@$(MAKE) backup
	@$(MAKE) build
	@$(MAKE) restart
	docker image prune -f --filter "label=$(PRUNE_LABEL)"

help:
	@echo "Targets:"
	@echo "  make dev      - 本地启动开发服务器"
	@echo "  make build    - 构建 Docker 镜像"
	@echo "  make start    - 启动服务（docker compose up -d）"
	@echo "  make stop     - 停止服务"
	@echo "  make restart  - 重启服务"
	@echo "  make logs     - 查看服务日志"
	@echo "  make backup   - 备份 SQLite 数据库"
	@echo "  make deploy   - git pull + 备份 + 构建镜像 + 重启服务"
