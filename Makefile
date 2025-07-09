# Makefile for iceberg-tables-example
# Usage: run `make <target>`

.PHONY: help start stop bootstrap deploy logs reset

help:
	@echo "Usage: make <target>"
	@echo "Available targets:"
	@echo "  start             Start LocalStack and CDK containers in detached mode"
	@echo "  stop              Stop all running containers"
	@echo "  bootstrap         Bootstrap CDK Local environment (inside the cdk container)"
	@echo "  deploy            Deploy CDK stacks into LocalStack (inside the cdk container)"
	@echo "  logs              View logs from all containers"
	@echo "  reset             Tear down and rebuild containers with a clean state"

start:
	docker compose up -d --build

stop:
	docker compose down

bootstrap:
	docker compose exec cdk bash -lc "cdklocal bootstrap -c env=local -v"

deploy:
	docker compose exec cdk bash -lc "yarn deploy:local:internal -v"

logs:
	docker compose logs -f

reset:
	docker compose down -v
	docker compose build
	docker compose up -d
