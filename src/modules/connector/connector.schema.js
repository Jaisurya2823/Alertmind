/**
 * AlertMind — Connector Validation Schemas
 * Per-type config validation ensures a Splunk connector can't be saved
 * with Elastic fields and vice versa — prevents silent misconfiguration.
 */

import { z } from 'zod';
import { MIN_SYNC_INTERVAL_MINUTES, MAX_SYNC_INTERVAL_MINUTES } from './connector.constants.js';

const splunkConfigSchema = z.object({
  baseUrl: z.string().url('Must be a valid URL, e.g. https://splunk.corp.local:8089'),
  token: z.string().min(10, 'Splunk token looks too short — verify you copied the full token'),
  indexes: z.array(z.string()).max(20).optional(),
  searchQuery: z.string().max(2000).optional(),
  verifySSL: z.boolean().default(true),
});

const elasticConfigSchema = z.object({
  baseUrl: z.string().url('Must be a valid URL, e.g. https://elastic.corp.local:9200'),
  apiKey: z.string().min(10, 'Elastic API key looks too short — verify you copied the full key'),
  indexPattern: z.string().min(1).max(200).default('logs-*'),
  query: z.record(z.unknown()).optional(),
  verifySSL: z.boolean().default(true),
});

export const createConnectorSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SPLUNK'),
    workspaceId: z.string().uuid(),
    name: z.string().min(1).max(100).trim(),
    config: splunkConfigSchema,
    syncIntervalMinutes: z.coerce
      .number()
      .int()
      .min(MIN_SYNC_INTERVAL_MINUTES)
      .max(MAX_SYNC_INTERVAL_MINUTES)
      .default(15),
  }),
  z.object({
    type: z.literal('ELASTIC'),
    workspaceId: z.string().uuid(),
    name: z.string().min(1).max(100).trim(),
    config: elasticConfigSchema,
    syncIntervalMinutes: z.coerce
      .number()
      .int()
      .min(MIN_SYNC_INTERVAL_MINUTES)
      .max(MAX_SYNC_INTERVAL_MINUTES)
      .default(15),
  }),
]);

export const updateConnectorSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  syncIntervalMinutes: z.coerce
    .number()
    .int()
    .min(MIN_SYNC_INTERVAL_MINUTES)
    .max(MAX_SYNC_INTERVAL_MINUTES)
    .optional(),
});

export const connectorIdParamSchema = z.object({
  id: z.string().uuid('Invalid connector ID'),
});

export const testConnectionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SPLUNK'), config: splunkConfigSchema }),
  z.object({ type: z.literal('ELASTIC'), config: elasticConfigSchema }),
]);

export { splunkConfigSchema, elasticConfigSchema };
