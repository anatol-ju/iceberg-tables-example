# Makefile for iceberg-tables-example
# Usage: run `make <target>`

.PHONY: help start-local deploy-local stop logs reset local

help:
	@echo "Usage: make <target>"
	@echo "Available targets:"
	@echo "  start             Start LocalStack and CDK containers in detached mode"
	@echo "  stop              Stop all running containers"
	@echo "  bootstrap         FIRST RUN ONLY Bootstrap CDK Local environment (inside the cdk container)"
	@echo "  deploy            Deploy CDK stacks into LocalStack (inside the cdk container)"
	@echo "  logs              View logs from all containers"
	@echo "  reset             Tear down and rebuild containers with a clean state"
	@echo "  local             Start and deploy locally with logging"

start:
	docker compose up -d --build

stop:
	docker compose down

bootstrap:
	AWS_ACCESS_KEY_ID=test \
	AWS_SECRET_ACCESS_KEY=test \
	AWS_REGION=eu-west-1 \
	AWS_S3_ADDRESSING_STYLE=path \
	AWS_S3_FORCE_PATH_STYLE=1 \
	AWS_SDK_LOAD_CONFIG=1 \
	AWS_ENDPOINT_URL=http://localhost:4566 \
	AWS_ENDPOINT_URL_S3=http://s3.localhost.localstack.cloud:4566 \
	AWS_ENVAR_ALLOWLIST=AWS_REGION,AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY,AWS_ENDPOINT_URL,AWS_ENDPOINT_URL_S3,AWS_S3_FORCE_PATH_STYLE \
	docker exec cdk-runner cdklocal bootstrap -c env=local -v

deploy:
	AWS_ACCESS_KEY_ID=test \
	AWS_SECRET_ACCESS_KEY=test \
	AWS_REGION=eu-west-1 \
	AWS_S3_ADDRESSING_STYLE=path \
	AWS_S3_FORCE_PATH_STYLE=1 \
	AWS_SDK_LOAD_CONFIG=1 \
	AWS_ENDPOINT_URL=http://localhost:4566 \
	AWS_ENDPOINT_URL_S3=http://s3.localhost.localstack.cloud:4566 \
	AWS_ENVAR_ALLOWLIST=AWS_REGION,AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY,AWS_ENDPOINT_URL,AWS_ENDPOINT_URL_S3,AWS_S3_FORCE_PATH_STYLE \
	docker exec cdk-runner yarn deploy:local:internal -v

logs:
	docker compose logs -f

reset:
	docker compose down -v
	docker compose build
	docker compose up -d

local:
	@echo "🔧 Starting LocalStack and CDK containers..."
	@$(MAKE) start
	@echo "🚀 Deploying CDK stacks into LocalStack..."
	@$(MAKE) deploy
	@echo "✅ Local deployment complete."
