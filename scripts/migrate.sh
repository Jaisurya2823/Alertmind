#!/bin/sh
# AlertMind — Database Migration Script
# Used by CI/CD and Docker CMD
set -e

echo "AlertMind — Running database migrations"

# Wait for database to be ready (useful in Docker/K8s startup)
MAX_ATTEMPTS=30
ATTEMPT=0

until npx prisma migrate status --skip-generate > /dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT+1))
  if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
    echo "ERROR: Database not reachable after ${MAX_ATTEMPTS} attempts"
    exit 1
  fi
  echo "Waiting for database... (attempt ${ATTEMPT}/${MAX_ATTEMPTS})"
  sleep 2
done

echo "Database is ready. Applying migrations..."
npx prisma migrate deploy

echo "✓ Migrations complete"
