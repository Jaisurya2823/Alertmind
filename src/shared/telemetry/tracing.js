/**
 * AlertMind — Distributed Tracing
 * OpenTelemetry span creation for the AI pipeline and key operations,
 * plus the SDK bootstrap that actually makes traces export somewhere.
 *
 * Without calling initializeTracing(), trace.getTracer() below returns a
 * no-op tracer — spans are created but silently discarded. This file was
 * previously missing that bootstrap despite the SDK packages being installed.
 */

import { trace, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import logger from '../logger/logger.js';

const tracer = trace.getTracer('alertmind', process.env.npm_package_version || '1.0.0');

/** @type {NodeSDK | null} */
let _sdk = null;

/**
 * Initializes the OpenTelemetry NodeSDK with an OTLP HTTP exporter.
 * No-ops safely if OTEL_EXPORTER_OTLP_ENDPOINT is not configured — tracing
 * is optional infrastructure, its absence must never block the app from starting.
 *
 * Deliberately does NOT use @opentelemetry/auto-instrumentations-node.
 * That package auto-instruments dozens of libraries we don't use and adds
 * significant install weight. We instrument what actually matters —
 * AI agent calls and DB queries — explicitly via traceAgent()/traceDb()
 * below, which produces more useful spans for this application than
 * generic auto-instrumentation would.
 */
export function initializeTracing() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) {
    logger.debug('OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled');
    return;
  }

  try {
    _sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'alertmind',
        [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.0.0',
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${endpoint.replace(/\/+$/, '')}/v1/traces`,
      }),
      // No auto-instrumentations — see comment above
      instrumentations: [],
    });

    _sdk.start();
    logger.info({ endpoint }, 'OpenTelemetry tracing initialized');
  } catch (err) {
    // Tracing failure must never prevent the app from starting
    logger.warn({ err: err.message }, 'Failed to initialize OpenTelemetry — continuing without tracing');
    _sdk = null;
  }
}

/**
 * Gracefully shuts down the tracing SDK, flushing any buffered spans.
 * Call during graceful shutdown alongside DB/Redis disconnects.
 */
export async function shutdownTracing() {
  if (_sdk) {
    await _sdk.shutdown().catch((err) => logger.warn({ err: err.message }, 'Error shutting down OTel SDK'));
    _sdk = null;
  }
}

/**
 * Wraps an async function in an OpenTelemetry span.
 * @template T
 * @param {string} spanName
 * @param {(span: import('@opentelemetry/api').Span) => Promise<T>} fn
 * @param {Record<string, string | number | boolean>} [attributes]
 * @returns {Promise<T>}
 */
export async function withSpan(spanName, fn, attributes = {}) {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      // Set attributes
      Object.entries(attributes).forEach(([k, v]) => span.setAttribute(k, v));

      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Creates a span for an AI agent execution.
 * @param {string} agentName
 * @param {string} model
 * @param {() => Promise<unknown>} fn
 */
export function traceAgent(agentName, model, fn) {
  return withSpan(`ai.agent.${agentName.toLowerCase()}`, fn, {
    'ai.agent.name': agentName,
    'ai.model': model,
    'component': 'alertmind-ai',
  });
}

/**
 * Creates a span for a database operation.
 * @param {string} operation - e.g. 'findUnique', 'create', 'update'
 * @param {string} model - Prisma model name
 * @param {() => Promise<unknown>} fn
 */
export function traceDb(operation, model, fn) {
  return withSpan(`db.${model}.${operation}`, fn, {
    'db.operation': operation,
    'db.model': model,
    'component': 'alertmind-db',
  });
}

export { tracer };
