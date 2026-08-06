IMAGE = ai-graveyard/we-match
VERSION = latest
# 和 Dockerfile 最终阶段的 LABEL 保持一致，deploy 用它把清理限定在自己的镜像上。
PRUNE_LABEL = com.ai-graveyard.project=we-match

.DEFAULT_GOAL := help

.PHONY: dev build start stop restart logs deploy help

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

deploy:
	git pull --ff-only
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
	@echo "  make deploy   - git pull + 构建镜像 + 重启服务"
