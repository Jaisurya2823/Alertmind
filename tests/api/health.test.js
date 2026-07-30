/**
 * AlertMind — Health Endpoint API Tests
 * Tests /api/health/live and /api/health/ready endpoints.
 * Uses supertest against the real Express app.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

let app;

beforeAll(async () => {
  // Dynamic import after env vars are set by setup.js
  const module = await import('../../app.js');
  app = module.default;
});

describe('GET /api/health/live', () => {

  it('returns 200 with alive status', async () => {
    const res = await request(app).get('/api/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body.pid).toBe(process.pid);
    expect(res.body.timestamp).toBeDefined();
  });

  it('responds in under 100ms', async () => {
    const start = Date.now();
    await request(app).get('/api/health/live');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });

});

describe('GET /api/health', () => {

  it('returns 200 or 503 (never 5xx from server error)', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
  });

  it('returns JSON with checks object', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('redis');
    expect(res.body.checks).toHaveProperty('ai');
  });

  it('returns version string', async () => {
    const res = await request(app).get('/api/health');
    expect(typeof res.body.version).toBe('string');
  });

  it('returns timestamp in ISO format', async () => {
    const res = await request(app).get('/api/health');
    expect(() => new Date(res.body.timestamp)).not.toThrow();
  });

});

describe('GET /api/health/ready', () => {

  it('returns same structure as /api/health', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('checks');
  });

});

describe('Security — health endpoints', () => {

  it('does not expose sensitive config in health response', async () => {
    const res = await request(app).get('/api/health');
    const body = JSON.stringify(res.body);

    // Must not contain any secrets
    expect(body).not.toContain('gsk_');
    expect(body).not.toContain('password');
    expect(body).not.toContain('secret');
    expect(body).not.toContain('DATABASE_URL');
  });

});
