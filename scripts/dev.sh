#!/bin/sh
# AlertMind — Development Startup Script
set -e

echo "AlertMind — Starting development environment"
echo ""

# Check .env exists
if [ ! -f ".env" ]; then
  echo "ERROR: .env file not found."
  echo "Run: cp .env.example .env and fill in your values."
  exit 1
fi

# Check Groq API key is set
if ! grep -q "^GROQ_API_KEY=gsk_" .env; then
  echo "WARNING: GROQ_API_KEY not set or invalid in .env"
  echo "Get your key at: https://console.groq.com"
fi

# Start Docker services if not running
if ! docker compose ps --quiet postgres 2>/dev/null | grep -q .; then
  echo "Starting database services..."
  docker compose up -d postgres redis minio
  echo "Waiting for services to be healthy..."
  sleep 5
fi

# Run migrations
echo "Running database migrations..."
npx prisma migrate dev --skip-seed

echo ""
echo "Starting AlertMind development server..."
echo "  URL: http://localhost:3000"
echo "  API: http://localhost:3000/api/v1"
echo ""

# Start with Node.js file watcher
node --watch --env-file=.env server.js
