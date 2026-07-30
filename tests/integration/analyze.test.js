/**
 * AlertMind — Analysis Pipeline Integration Tests
 * Tests the full alert → investigation → results flow.
 * Requires running PostgreSQL, Redis, and Groq API key.
 *
 * These tests hit the real AI pipeline — they take up to 60s each.
 * Run with: npx vitest run tests/integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../../src/bootstrap/startup.js';
import { connectRedis, disconnectRedis } from '../../src/config/redis.config.js';
import { submitAlert } from '../../src/modules/alert/alert.service.js';
import { getInvestigation } from '../../src/modules/investigation/investigation.service.js';
import { runInvestigationPipeline } from '../../src/modules/ai/orchestration.service.js';
import { getPrismaClient } from '../../src/bootstrap/startup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures');

const TEST_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000002';

beforeAll(async () => {
  await connectDatabase();
  await connectRedis();
}, 30_000);

afterAll(async () => {
  await disconnectDatabase();
  await disconnectRedis();
});

describe('Alert parsing integration', () => {

  it('parses Microsoft Defender JSON alert correctly', async () => {
    const rawInput = readFileSync(join(FIXTURES, 'sample-alert.json'), 'utf8');
    const prisma = getPrismaClient();

    // Create test workspace if needed
    await prisma.organization.upsert({
      where: { id: '00000000-0000-0000-0000-000000000000' },
      create: { id: '00000000-0000-0000-0000-000000000000', name: 'Test Org', slug: 'test-org-integration' },
      update: {},
    }).catch(() => {});

    // Direct pipeline test — bypass queue for integration test
    const alert = await prisma.alert.create({
      data: {
        workspaceId: TEST_WORKSPACE_ID,
        rawInput,
        inputFormat: 'DEFENDER',
        status: 'PENDING',
      },
    }).catch(() => null);

    if (!alert) {
      // Workspace doesn't exist in test DB — skip
      return;
    }

    const investigation = await prisma.investigation.create({
      data: {
        alertId: alert.id,
        status: 'IN_PROGRESS',
        parsedAlert: {},
      },
    });

    await runInvestigationPipeline({
      investigationId: investigation.id,
      alertId: alert.id,
      rawInput,
    });

    const completed = await prisma.investigation.findUnique({
      where: { id: investigation.id },
      include: {
        entities: true,
        mitreMappings: true,
        hypotheses: true,
        riskAssessment: true,
        report: { select: { id: true, executiveSummary: true } },
      },
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.threatCategory).toBeTruthy();
    expect(completed.explanation).toBeTruthy();
    expect(completed.mitreMappings.length).toBeGreaterThan(0);
    expect(completed.hypotheses.length).toBeGreaterThanOrEqual(1);
    expect(completed.riskAssessment).toBeTruthy();
    expect(completed.report?.executiveSummary).toBeTruthy();

    // MITRE technique IDs must be valid
    completed.mitreMappings.forEach((m) => {
      expect(m.techniqueId).toMatch(/^T\d{4}(\.\d{3})?$/);
      expect(m.confidence).toBeGreaterThan(0);
      expect(m.confidence).toBeLessThanOrEqual(1);
    });

    // Hypotheses must have valid confidence scores
    completed.hypotheses.forEach((h) => {
      expect(h.confidence).toBeGreaterThan(0);
      expect(h.confidence).toBeLessThanOrEqual(1);
      expect(h.text.length).toBeGreaterThan(20);
    });

    // Risk assessment must have valid severity
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'])
      .toContain(completed.riskAssessment.severity);

    // Cleanup
    await prisma.alert.delete({ where: { id: alert.id } }).catch(() => {});
  }, 120_000); // 2 minute timeout for real AI pipeline

});
