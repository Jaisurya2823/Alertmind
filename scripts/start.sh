#!/bin/sh
# AlertMind — Production Startup Script
set -e

echo "AlertMind — Starting production server"

# Pre-flight: verify required env vars
required_vars="GROQ_API_KEY AUTH_SECRET DATABASE_URL REDIS_HOST JWT_PRIVATE_KEY JWT_PUBLIC_KEY CSRF_SECRET ENCRYPTION_KEY"
missing=""

for var in $required_vars; do
  val=$(eval echo "\$$var")
  if [ -z "$val" ]; then
    missing="$missing $var"
  fi
done

if [ -n "$missing" ]; then
  echo "ERROR: Missing required environment variables:$missing"
  exit 1
fi

echo "→ Running database migrations..."
npx prisma migrate deploy

echo "→ Starting AlertMind server..."
exec node server.js
