# AlertMind — Developer Makefile
# Usage: make <target>

.PHONY: help install dev start stop build test test-unit test-api test-e2e \
        db-migrate db-reset db-studio db-seed keys docker-up docker-down \
        docker-logs docker-build clean lint format audit

# ─── Default ────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "AlertMind — Developer Commands"
	@echo "────────────────────────────────"
	@echo "  make install        Install dependencies and generate Prisma client"
	@echo "  make keys           Generate RSA key pair for JWT signing"
	@echo "  make dev            Start development server (hot reload)"
	@echo "  make start          Start production server"
	@echo "  make docker-up      Start all services (app + DB + Redis + MinIO)"
	@echo "  make docker-down    Stop all services"
	@echo "  make docker-logs    Tail all service logs"
	@echo "  make docker-build   Rebuild Docker image"
	@echo "  make db-migrate     Run pending database migrations"
	@echo "  make db-reset       Reset database (DESTROYS ALL DATA)"
	@echo "  make db-studio      Open Prisma Studio (DB browser)"
	@echo "  make db-seed        Seed MITRE ATT&CK reference data"
	@echo "  make test           Run all tests"
	@echo "  make test-unit      Run unit tests only"
	@echo "  make test-api       Run API tests only"
	@echo "  make test-e2e       Run end-to-end tests"
	@echo "  make lint           Run ESLint"
	@echo "  make format         Format code with Prettier"
	@echo "  make audit          Run npm security audit"
	@echo "  make clean          Remove node_modules, logs, temp files"
	@echo ""

# ─── Setup ──────────────────────────────────────────────────────────────────
install:
	@echo "→ Installing dependencies..."
	npm ci
	@echo "→ Generating Prisma client..."
	npx prisma generate
	@echo "→ Creating storage directories..."
	mkdir -p storage/uploads storage/exports storage/reports storage/temp storage/cache logs
	@echo "✓ Installation complete. Run 'make keys' then 'make docker-up'"

keys:
	@echo "→ Generating all required secrets (AUTH_SECRET, CSRF_SECRET, ENCRYPTION_KEY, JWT keys)..."
	node scripts/generate-secrets.js
	@echo ""
	@echo "✓ Copy the lines above into your .env file — nothing was written to disk."

# ─── Development ────────────────────────────────────────────────────────────
dev:
	@echo "→ Starting AlertMind in development mode..."
	node --watch --env-file=.env server.js

start:
	@echo "→ Starting AlertMind in production mode..."
	node server.js

# ─── Database ────────────────────────────────────────────────────────────────
db-migrate:
	@echo "→ Running Prisma migrations..."
	npx prisma migrate deploy

db-migrate-dev:
	@echo "→ Running Prisma dev migrations..."
	npx prisma migrate dev

db-reset:
	@echo "⚠ This will DESTROY ALL DATA in the database!"
	@read -p "Are you sure? (yes/no): " confirm && [ "$$confirm" = "yes" ] || exit 1
	npx prisma migrate reset --force
	@echo "✓ Database reset complete"

db-studio:
	@echo "→ Opening Prisma Studio..."
	npx prisma studio

db-seed:
	@echo "→ Seeding MITRE ATT&CK reference data..."
	node scripts/seed.js

# ─── Docker ──────────────────────────────────────────────────────────────────
docker-up:
	@echo "→ Starting all AlertMind services..."
	docker compose up -d
	@echo "✓ Services started"
	@echo "  App:       http://localhost:3000"
	@echo "  MinIO UI:  http://localhost:9001"
	@echo "  Grafana:   http://localhost:3001"
	@echo "  Prometheus:http://localhost:9090"

docker-down:
	@echo "→ Stopping all AlertMind services..."
	docker compose down

docker-build:
	@echo "→ Building Docker image..."
	docker compose build app

docker-logs:
	docker compose logs -f

docker-restart:
	docker compose restart app

# ─── Testing ─────────────────────────────────────────────────────────────────
test:
	@echo "→ Running all tests..."
	npm test

test-unit:
	@echo "→ Running unit tests..."
	npx vitest run tests/unit

test-api:
	@echo "→ Running API tests..."
	npx vitest run tests/api

test-e2e:
	@echo "→ Running E2E tests..."
	npx playwright test

test-coverage:
	@echo "→ Running tests with coverage..."
	npx vitest run --coverage

# ─── Code Quality ────────────────────────────────────────────────────────────
lint:
	@echo "→ Running ESLint..."
	npx eslint src --ext .js

format:
	@echo "→ Formatting code..."
	npx prettier --write "src/**/*.js" "tests/**/*.js"

format-check:
	npx prettier --check "src/**/*.js"

audit:
	@echo "→ Running npm security audit..."
	npm audit --audit-level=high

# ─── Cleanup ─────────────────────────────────────────────────────────────────
clean:
	@echo "→ Cleaning up..."
	rm -rf node_modules
	rm -rf coverage
	rm -rf playwright-report
	rm -rf test-results
	rm -f logs/*.log
	rm -rf storage/temp/*
	rm -rf storage/cache/*
	@echo "✓ Cleanup complete"
