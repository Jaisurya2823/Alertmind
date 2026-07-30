/**
 * AlertMind — Prometheus Metrics
 * Separate HTTP server on METRICS_PORT to avoid exposing metrics on public port
 * Counters, histograms, and gauges for all critical platform operations
 */

import { createServer } from 'node:http';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';
import logger from '../logger/logger.js';

const register = new Registry();

// ─── Default Node.js Metrics ─────────────────────────────────────────────────
collectDefaultMetrics({
  register,
  prefix: 'alertmind_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ─── HTTP Request Metrics ────────────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
  name: 'alertmind_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'alertmind_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ─── AI Pipeline Metrics ─────────────────────────────────────────────────────
export const aiAnalysisDuration = new Histogram({
  name: 'alertmind_ai_analysis_duration_seconds',
  help: 'Duration of complete AI investigation pipeline',
  labelNames: ['model', 'status'],
  buckets: [1, 5, 10, 20, 30, 45, 60, 90, 120],
  registers: [register],
});

export const aiAgentDuration = new Histogram({
  name: 'alertmind_ai_agent_duration_seconds',
  help: 'Duration of individual AI agent execution',
  labelNames: ['agent', 'model', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30],
  registers: [register],
});

export const aiTokensUsed = new Counter({
  name: 'alertmind_ai_tokens_used_total',
  help: 'Total AI tokens consumed',
  labelNames: ['model', 'agent', 'type'],
  registers: [register],
});

export const aiErrorTotal = new Counter({
  name: 'alertmind_ai_errors_total',
  help: 'Total AI pipeline errors',
  labelNames: ['agent', 'error_type'],
  registers: [register],
});

// ─── Investigation Metrics ───────────────────────────────────────────────────
export const investigationsTotal = new Counter({
  name: 'alertmind_investigations_total',
  help: 'Total investigations processed',
  labelNames: ['status', 'severity', 'source'],
  registers: [register],
});

export const activeInvestigations = new Gauge({
  name: 'alertmind_active_investigations',
  help: 'Number of investigations currently in progress',
  registers: [register],
});

// ─── Queue Metrics ───────────────────────────────────────────────────────────
export const queueJobDuration = new Histogram({
  name: 'alertmind_queue_job_duration_seconds',
  help: 'Duration of BullMQ job processing',
  labelNames: ['queue', 'job_name', 'status'],
  buckets: [0.5, 1, 5, 10, 30, 60, 120],
  registers: [register],
});

export const queueJobTotal = new Counter({
  name: 'alertmind_queue_jobs_total',
  help: 'Total queue jobs processed',
  labelNames: ['queue', 'job_name', 'status'],
  registers: [register],
});

export const queueDepth = new Gauge({
  name: 'alertmind_queue_depth',
  help: 'Current number of jobs in queue',
  labelNames: ['queue', 'status'],
  registers: [register],
});

// ─── Database Metrics ────────────────────────────────────────────────────────
export const dbQueryDuration = new Histogram({
  name: 'alertmind_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// ─── Cache Metrics ───────────────────────────────────────────────────────────
export const cacheHitTotal = new Counter({
  name: 'alertmind_cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['key_prefix'],
  registers: [register],
});

export const cacheMissTotal = new Counter({
  name: 'alertmind_cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['key_prefix'],
  registers: [register],
});

// ─── Metrics HTTP Server ─────────────────────────────────────────────────────
let _metricsServer = null;

/**
 * Starts a dedicated HTTP server for Prometheus scraping.
 * Separate from main app server — never expose on public port.
 * @param {number} port
 */
export async function startMetricsServer(port = 9090) {
  _metricsServer = createServer(async (req, res) => {
    if (req.url === '/metrics') {
      try {
        const metrics = await register.metrics();
        res.setHeader('Content-Type', register.contentType);
        res.writeHead(200);
        res.end(metrics);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    } else if (req.url === '/health') {
      res.writeHead(200);
      res.end('OK');
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise((resolve, reject) => {
    _metricsServer.on('error', reject);
    _metricsServer.listen(port, '127.0.0.1', () => {
      _metricsServer.off('error', reject);
      resolve();
    });
  });

  logger.info({ port, bind: '127.0.0.1' }, 'Prometheus metrics server listening');
}

/**
 * Gracefully stops the metrics server.
 */
export async function stopMetricsServer() {
  if (_metricsServer) {
    await new Promise((resolve) => _metricsServer.close(resolve));
    _metricsServer = null;
  }
}

export { register };
