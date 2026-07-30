/**
 * AlertMind — Connector Provider Registry
 * Central factory — adding a new connector type means implementing the
 * provider interface and registering it here. Nothing else needs to change.
 */

import * as splunkProvider from './splunk.provider.js';
import * as elasticProvider from './elastic.provider.js';
import { BadRequestError } from '../../../shared/errors/app.error.js';

const REGISTRY = Object.freeze({
  SPLUNK: splunkProvider,
  ELASTIC: elasticProvider,
});

/**
 * Returns the provider implementation for a connector type.
 * @param {string} type
 * @returns {import('./provider.interface.js').ConnectorProvider}
 */
export function getProvider(type) {
  const provider = REGISTRY[type];
  if (!provider) {
    throw new BadRequestError(`Unsupported connector type: ${type}. Supported: ${Object.keys(REGISTRY).join(', ')}`);
  }
  return provider;
}

export function getSupportedTypes() {
  return Object.keys(REGISTRY);
}
