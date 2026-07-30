# AlertMind — Operational Runbook

## Alert: HighErrorRate (5xx > 5%)

1. Check recent deployments: `kubectl rollout history deployment/alertmind -n alertmind`
2. Check pod logs: `kubectl logs -l app=alertmind -n alertmind --tail=200`
3. Check Sentry for grouped errors
4. If caused by a bad deploy: `kubectl rollout undo deployment/alertmind -n alertmind`

## Alert: SlowAIAnalysis (P95 > 90s)

1. Check Groq API status: https://status.groq.com
2. Check `alertmind_ai_agent_duration_seconds` by agent — identify which stage is slow
3. Check for rate limiting from Groq (429s) in logs: `grep "Groq rate limit" logs/*.log`
4. If persistent: consider increasing `QUEUE_CONCURRENCY` reduction to lower parallel load on Groq

## Alert: AlertMindDown

1. Check pod status: `kubectl get pods -n alertmind -l app=alertmind`
2. Check readiness probe failures: `kubectl describe pod <pod-name> -n alertmind`
3. Check `/api/health` manually: which dependency is failing (db/redis/ai)?
4. If database: check PostgreSQL connection pool exhaustion
5. If Redis: check Redis memory usage and eviction policy

## Alert: QueueBacklog (>100 waiting jobs)

1. Check worker health: are BullMQ workers processing? `alertmind_queue_jobs_total{status="completed"}` rate
2. Check for stuck jobs: query BullMQ for jobs in `active` state longer than `QUEUE_JOB_TIMEOUT_MS`
3. Scale up: increase replica count or `QUEUE_CONCURRENCY`
4. If Groq is the bottleneck (not worker capacity), backlog will persist — this is expected under high AI rate limiting; consider raising `AI_RATE_LIMIT_MAX_REQUESTS` if within Groq's plan limits

## Common Issues

### "GROQ_API_KEY not configured" on startup
Environment variable missing or doesn't start with `gsk_`. Check `.env` or K8s secret.

### Argon2 native module fails to load in Docker
Rebuild the image — the multi-stage Dockerfile compiles argon2 in the builder stage with `python3 make g++`. If this error occurs, the builder stage may have failed silently; check build logs.

### PDF generation fails with "Could not find Chromium"
Ensure `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` is set and the Alpine `chromium` package is installed (handled in Dockerfile).

### Rate limits not enforced across pods
Verify `rate-limit-redis` is connected — check `REDIS_HOST`/`REDIS_PORT` env vars. In-memory fallback only happens if Redis is misconfigured, which would also fail health checks.

### Investigation stuck in IN_PROGRESS
Check if the BullMQ job failed silently. Query: `SELECT * FROM investigations WHERE status = 'IN_PROGRESS' AND created_at < NOW() - INTERVAL '5 minutes';` — these can be retried via `POST /api/v1/investigations/:id/retry` after manually marking as FAILED.

## Escalation

- P1 (service down): Page on-call immediately
- P2 (degraded, error rate elevated): Notify team Slack channel
- P3 (single-agent failures, non-blocking): Log for next business day review
