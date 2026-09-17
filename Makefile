.DEFAULT_GOAL := help
BACKEND := backend
FRONTEND := frontend
BACKEND_PORT ?= 8007
FRONTEND_PORT ?= 3007

# Targets are namespaced per component (backend-*, and frontend-* once Next.js
# lands); the unprefixed aggregates run that task for every component.

.PHONY: help
help:  ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Backend ---------------------------------------------------------------

.PHONY: backend
backend:  ## Run the Django development server
	cd $(BACKEND) && uv run manage.py runserver 0.0.0.0:$(BACKEND_PORT)

.PHONY: backend-install
backend-install:  ## Install backend dependencies and git hooks
	cd $(BACKEND) && uv sync && uv run pre-commit install

.PHONY: backend-worker
backend-worker:  ## Run the django-q2 cluster
	cd $(BACKEND) && uv run manage.py qcluster

.PHONY: backend-migrate
backend-migrate:  ## Apply migrations
	cd $(BACKEND) && uv run manage.py migrate

.PHONY: backend-migrations
backend-migrations:  ## Create migrations for model changes
	cd $(BACKEND) && uv run manage.py makemigrations

.PHONY: backend-superuser
backend-superuser:  ## Create an admin user
	cd $(BACKEND) && uv run manage.py createsuperuser

.PHONY: backend-shell
backend-shell:  ## Open a Django shell
	cd $(BACKEND) && uv run manage.py shell

.PHONY: backend-test
backend-test:  ## Run the backend test suite
	cd $(BACKEND) && uv run pytest

.PHONY: backend-coverage
backend-coverage:  ## Run backend tests with a coverage report
	cd $(BACKEND) && uv run pytest --cov --cov-report=term-missing

.PHONY: backend-lint
backend-lint:  ## Check backend formatting and lint rules
	cd $(BACKEND) && uv run ruff check . && uv run ruff format --check .

.PHONY: backend-fmt
backend-fmt:  ## Auto-fix and format backend code
	cd $(BACKEND) && uv run ruff check --fix . && uv run ruff format .

.PHONY: backend-check
backend-check:  ## Django system checks and missing-migration check
	cd $(BACKEND) && uv run manage.py check && uv run manage.py makemigrations --check --dry-run

.PHONY: backend-schema
backend-schema:  ## Regenerate backend/openapi.json (input for Orval)
	cd $(BACKEND) && uv run manage.py export_openapi_schema --api config.api.api --output openapi.json --indent 2

# --- Frontend --------------------------------------------------------------

.PHONY: frontend
frontend:  ## Run the Next.js development server
	cd $(FRONTEND) && bun run dev --port $(FRONTEND_PORT)

.PHONY: frontend-install
frontend-install:  ## Install frontend dependencies
	cd $(FRONTEND) && bun install

.PHONY: frontend-build
frontend-build:  ## Build the production bundle
	cd $(FRONTEND) && bun run build

.PHONY: frontend-test
frontend-test:  ## Run the frontend test suite
	cd $(FRONTEND) && bun run test

.PHONY: frontend-coverage
frontend-coverage:  ## Run frontend tests with a coverage report
	cd $(FRONTEND) && bun run test:coverage

.PHONY: frontend-lint
frontend-lint:  ## Check frontend formatting, lint rules and types
	cd $(FRONTEND) && bun run lint && bun run format:check && bun run typecheck

.PHONY: frontend-fmt
frontend-fmt:  ## Auto-fix and format frontend code
	cd $(FRONTEND) && bun run lint:fix && bun run format

.PHONY: frontend-check
frontend-check:  ## Verify the generated API client matches the schema
	cd $(FRONTEND) && bun run api:generate && git diff --exit-code src/lib/api/generated

.PHONY: frontend-api
frontend-api:  ## Regenerate the Orval client from backend/openapi.json
	cd $(FRONTEND) && bun run api:generate

# --- Infrastructure --------------------------------------------------------

.PHONY: up
up:  ## Start Postgres only (for running the backend on the host)
	docker compose up -d db

.PHONY: stack
stack:  ## Build and start the whole stack in Docker
	docker compose up --build

.PHONY: down
down:  ## Stop the stack
	docker compose down

.PHONY: logs
logs:  ## Tail the stack logs
	docker compose logs -f

# --- Deploy ------------------------------------------------------------

.PHONY: deploy-setup
deploy-setup:  ## One-time bootstrap for SERVER (keys, secrets, branch, VM clone)
	deploy/scripts/setup.sh $(SERVER)

.PHONY: deploy-env-put
deploy-env-put:  ## Push local .env.$(SERVER) to the VM
	deploy/scripts/env.sh put $(SERVER)

.PHONY: deploy-env-get
deploy-env-get:  ## Pull the VM's .env down to .env.$(SERVER)
	deploy/scripts/env.sh get $(SERVER)

.PHONY: deploy
deploy:  ## Re-trigger the deploy workflow for SERVER
	deploy/scripts/deploy.sh $(SERVER)

.PHONY: deploy-logs
deploy-logs:  ## Tail SERVER's remote container logs
	deploy/scripts/logs.sh $(SERVER)

.PHONY: deploy-restart
deploy-restart:  ## Recreate SERVER's containers without rebuilding
	deploy/scripts/restart.sh $(SERVER)

# --- Aggregates ------------------------------------------------------------

.PHONY: install
install: backend-install frontend-install  ## Install every component's dependencies

.PHONY: test
test: backend-test frontend-test  ## Run every test suite

.PHONY: lint
lint: backend-lint frontend-lint  ## Lint every component

.PHONY: fmt
fmt: backend-fmt frontend-fmt  ## Format every component

.PHONY: check
check: backend-check frontend-check  ## Run every component's checks

.PHONY: schema
schema: backend-schema frontend-api  ## Regenerate the OpenAPI schema and API client
