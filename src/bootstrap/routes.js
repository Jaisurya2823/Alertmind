/**
 * AlertMind — Route Registration
 * All API routes mounted here. Order matters for middleware and specificity.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';

import healthRoutes from '../modules/health/health.routes.js';
import authRoutes from '../modules/user/user.routes.js';
import organizationRoutes from '../modules/organization/organization.routes.js';
import workspaceRoutes from '../modules/workspace/workspace.routes.js';
import alertRoutes from '../modules/alert/alert.routes.js';
import investigationRoutes from '../modules/investigation/investigation.routes.js';
import aiRoutes from '../modules/ai/ai.routes.js';
import mitreRoutes from '../modules/mitre/mitre.routes.js';
import iocRoutes from '../modules/ioc/ioc.routes.js';
import entityRoutes from '../modules/entities/entities.routes.js';
import threatRoutes from '../modules/threat/threat.routes.js';
import hypothesisRoutes from '../modules/hypothesis/hypothesis.routes.js';
import riskRoutes from '../modules/risk/risk.routes.js';
import recommendationRoutes from '../modules/recommendation/recommendation.routes.js';
import reportRoutes from '../modules/report/report.routes.js';
import timelineRoutes from '../modules/timeline/timeline.routes.js';
import correlationRoutes from '../modules/correlation/correlation.routes.js';
import searchRoutes from '../modules/search/search.routes.js';
import exportRoutes from '../modules/export/export.routes.js';
import connectorRoutes from '../modules/connector/connector.routes.js';
import knowledgeRoutes from '../modules/knowledge/knowledge.routes.js';
import apiKeyRoutes from '../modules/api-key/api-key.routes.js';
import billingRoutes from '../modules/billing/billing.routes.js';
import notificationRoutes from '../modules/notification/notification.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Registers all application routes on the Express instance.
 * @param {import('express').Application} app
 */
export function registerRoutes(app) {
  // ─── API Version Prefix ──────────────────────────────────────────────────
  const API_V1 = '/api/v1';

  // ─── Health (no auth — for load balancers and k8s probes) ───────────────
  app.use('/api/health', healthRoutes);

  // ─── OpenAPI / Swagger Docs (production: restrict to internal only) ──────
  if (process.env.NODE_ENV !== 'production') {
    try {
      const openapiPath = join(__dirname, '../docs/openapi.yaml');
      const openapiDocument = parseYaml(readFileSync(openapiPath, 'utf8'));
      app.use(
        '/api/docs',
        swaggerUi.serve,
        swaggerUi.setup(openapiDocument, {
          explorer: true,
          customCss: '.swagger-ui .topbar { display: none }',
        })
      );
    } catch {
      // OpenAPI file not yet generated — non-fatal in dev
    }
  }

  // ─── Authentication ──────────────────────────────────────────────────────
  app.use(`${API_V1}/auth`, authRoutes);

  // ─── Organization & Team Management ─────────────────────────────────────
  app.use(`${API_V1}/organizations`, organizationRoutes);
  app.use(`${API_V1}/workspaces`, workspaceRoutes);

  // ─── Core Investigation Pipeline ─────────────────────────────────────────
  app.use(`${API_V1}/alerts`, alertRoutes);
  app.use(`${API_V1}/investigations`, investigationRoutes);
  app.use(`${API_V1}/ai`, aiRoutes);

  // ─── Investigation Sub-modules ───────────────────────────────────────────
  app.use(`${API_V1}/mitre`, mitreRoutes);
  app.use(`${API_V1}/ioc`, iocRoutes);
  app.use(`${API_V1}/entities`, entityRoutes);
  app.use(`${API_V1}/threat`, threatRoutes);
  app.use(`${API_V1}/hypothesis`, hypothesisRoutes);
  app.use(`${API_V1}/risk`, riskRoutes);
  app.use(`${API_V1}/recommendations`, recommendationRoutes);
  app.use(`${API_V1}/reports`, reportRoutes);
  app.use(`${API_V1}/timeline`, timelineRoutes);
  app.use(`${API_V1}/correlation`, correlationRoutes);

  // ─── Search & Discovery ──────────────────────────────────────────────────
  app.use(`${API_V1}/search`, searchRoutes);

  // ─── Export ─────────────────────────────────────────────────────────────
  app.use(`${API_V1}/export`, exportRoutes);

  // ─── Integrations ───────────────────────────────────────────────────────
  app.use(`${API_V1}/connectors`, connectorRoutes);
  app.use(`${API_V1}/knowledge`, knowledgeRoutes);

  // ─── Account Management ──────────────────────────────────────────────────
  app.use(`${API_V1}/api-keys`, apiKeyRoutes);
  app.use(`${API_V1}/billing`, billingRoutes);
  app.use(`${API_V1}/notifications`, notificationRoutes);
  app.use(`${API_V1}/audit`, auditRoutes);
  app.use(`${API_V1}/analytics`, analyticsRoutes);
  app.use(`${API_V1}/settings`, settingsRoutes);
}
