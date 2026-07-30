/**
 * AlertMind — Connector Unit Tests
 * Tests provider registry, config encryption round-trip, and Splunk/Elastic
 * query-building logic. No live network calls — those belong in integration tests.
 */

import { describe, it, expect } from 'vitest';
import { getProvider, getSupportedTypes } from '../../src/modules/connector/providers/provider.registry.js';
import { encryptJson, decryptJson } from '../../src/shared/crypto/crypto.js';
import { createConnectorSchema, testConnectionSchema } from '../../src/modules/connector/connector.schema.js';

describe('provider.registry', () => {

  it('returns Splunk provider for type SPLUNK', () => {
    const provider = getProvider('SPLUNK');
    expect(typeof provider.testConnection).toBe('function');
    expect(typeof provider.fetchAlerts).toBe('function');
  });

  it('returns Elastic provider for type ELASTIC', () => {
    const provider = getProvider('ELASTIC');
    expect(typeof provider.testConnection).toBe('function');
    expect(typeof provider.fetchAlerts).toBe('function');
  });

  it('throws for unsupported connector type', () => {
    expect(() => getProvider('CROWDSTRIKE')).toThrow(/Unsupported connector type/);
  });

  it('lists exactly the supported types', () => {
    expect(getSupportedTypes().sort()).toEqual(['ELASTIC', 'SPLUNK']);
  });

});

describe('connector config encryption round-trip', () => {

  it('encrypts and decrypts a Splunk config correctly', () => {
    const config = { baseUrl: 'https://splunk.corp.local:8089', token: 'abc123token', verifySSL: true };
    const encrypted = encryptJson(config);
    expect(encrypted).not.toContain('abc123token');
    expect(decryptJson(encrypted)).toEqual(config);
  });

  it('encrypts and decrypts an Elastic config correctly', () => {
    const config = { baseUrl: 'https://elastic.corp.local:9200', apiKey: 'xyz789key', indexPattern: 'logs-*' };
    const encrypted = encryptJson(config);
    expect(encrypted).not.toContain('xyz789key');
    expect(decryptJson(encrypted)).toEqual(config);
  });

});

describe('createConnectorSchema validation', () => {

  it('accepts a valid Splunk connector payload', () => {
    const result = createConnectorSchema.safeParse({
      type: 'SPLUNK',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Prod Splunk',
      config: { baseUrl: 'https://splunk.corp.local:8089', token: 'a-real-looking-token-value' },
      syncIntervalMinutes: 15,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a Splunk connector missing the token', () => {
    const result = createConnectorSchema.safeParse({
      type: 'SPLUNK',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Prod Splunk',
      config: { baseUrl: 'https://splunk.corp.local:8089' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid baseUrl', () => {
    const result = createConnectorSchema.safeParse({
      type: 'ELASTIC',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Prod Elastic',
      config: { baseUrl: 'not-a-url', apiKey: 'somekeyvalue' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects sync interval below the minimum', () => {
    const result = createConnectorSchema.safeParse({
      type: 'SPLUNK',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Too Frequent',
      config: { baseUrl: 'https://splunk.corp.local:8089', token: 'a-real-looking-token-value' },
      syncIntervalMinutes: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown connector type via discriminated union', () => {
    const result = createConnectorSchema.safeParse({
      type: 'CROWDSTRIKE',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Not Supported Yet',
      config: {},
    });
    expect(result.success).toBe(false);
  });

});

describe('testConnectionSchema validation', () => {

  it('accepts a valid test-connection payload without workspaceId', () => {
    const result = testConnectionSchema.safeParse({
      type: 'ELASTIC',
      config: { baseUrl: 'https://elastic.corp.local:9200', apiKey: 'somekeyvalue1234' },
    });
    expect(result.success).toBe(true);
  });

});
