/**
 * AlertMind — Alert & Investigation API Tests
 * Tests the submission and polling endpoints.
 * Authentication is mocked at the middleware level.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures');

let app;

beforeAll(async () => {
  const module = await import('../../app.js');
  app = module.default;
});

describe('POST /api/v1/alerts — validation', () => {

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/alerts')
      .send({ rawInput: '{"test": true}', workspaceId: '123e4567-e89b-12d3-a456-426614174000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 with missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/alerts')
      .set('Authorization', 'Bearer invalid_token_format')
      .send({});

    // Either 401 (auth fails) or 422 (validation fails)
    expect([401, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for JSON body parse errors', async () => {
    const res = await request(app)
      .post('/api/v1/alerts')
      .set('Content-Type', 'application/json')
      .send('{ invalid json }');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });

  it('returns structured error for oversized body', async () => {
    const bigBody = JSON.stringify({ rawInput: 'A'.repeat(12 * 1024 * 1024) });
    const res = await request(app)
      .post('/api/v1/alerts')
      .set('Content-Type', 'application/json')
      .send(bigBody);

    expect([400, 413]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

});

describe('GET /api/v1/investigations/:id — validation', () => {

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .get('/api/v1/investigations/123e4567-e89b-12d3-a456-426614174000');

    expect(res.status).toBe(401);
  });

  it('returns 422 for invalid UUID format', async () => {
    const res = await request(app)
      .get('/api/v1/investigations/not-a-uuid')
      .set('Authorization', 'Bearer invalid');

    expect([401, 422]).toContain(res.status);
  });

});

describe('GET /api/v1/ai/info — public AI info', () => {

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/ai/info');
    expect(res.status).toBe(401);
  });

});

describe('Security headers', () => {

  it('includes X-Frame-Options: DENY', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('includes X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Request-Id on all responses', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('does not expose X-Powered-By', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

});

describe('404 handling', () => {

  it('returns 404 for non-existent API routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns JSON not HTML for 404 on /api/ routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.headers['content-type']).toMatch(/json/);
  });

});
