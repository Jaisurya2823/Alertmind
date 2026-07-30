/**
 * AlertMind — LLM Service (Groq)
 * All AI model calls go through this service.
 * Handles: retry logic, structured JSON output, token tracking, error classification.
 */

import Groq from 'groq-sdk';
import { getConfig } from '../../config/env.js';
import logger from '../../shared/logger/logger.js';
import { AIError } from '../../shared/errors/ai.error.js';
import { aiTokensUsed, aiAgentDuration, aiErrorTotal } from '../../shared/metrics/metrics.js';
import {
  GROQ_MODELS,
  LLM_RETRY_ATTEMPTS,
  LLM_RETRY_INITIAL_DELAY_MS,
  LLM_RETRY_MAX_DELAY_MS,
} from '../../shared/constants/ai.constants.js';

const config = getConfig();

// ─── Groq Client Singleton ───────────────────────────────────────────────────
let _groqClient = null;

function getGroqClient() {
  if (!_groqClient) {
    _groqClient = new Groq({
      apiKey: config.GROQ_API_KEY,
      maxRetries: 0, // We implement our own retry logic
      timeout: 90_000,
    });
  }
  return _groqClient;
}

/**
 * Sends a completion request to Groq and returns parsed JSON output.
 * Enforces JSON mode via response_format to guarantee structured output.
 *
 * @param {object} options
 * @param {string} options.agentName - For logging and metrics
 * @param {'PRIMARY'|'FAST'} options.modelTier - Which model to use
 * @param {string} options.systemPrompt
 * @param {string} options.userPrompt
 * @param {import('zod').ZodSchema} options.outputSchema - Zod schema to validate output
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @returns {Promise<unknown>} Validated, parsed JSON output
 */
export async function llmComplete({
  agentName,
  modelTier = 'PRIMARY',
  systemPrompt,
  userPrompt,
  outputSchema,
  temperature,
  maxTokens,
}) {
  const modelId = modelTier === 'FAST' ? GROQ_MODELS.FAST : GROQ_MODELS.PRIMARY;
  const effectiveTemp = temperature ?? config.GROQ_TEMPERATURE;
  const effectiveMaxTokens = maxTokens ?? config.GROQ_MAX_TOKENS;

  const startTime = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= LLM_RETRY_ATTEMPTS; attempt++) {
    try {
      logger.debug(
        { agent: agentName, model: modelId, attempt },
        'LLM request starting'
      );

      const response = await getGroqClient().chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: effectiveTemp,
        max_tokens: effectiveMaxTokens,
        // Force JSON output — Groq supports JSON mode
        response_format: { type: 'json_object' },
        stream: false,
      });

      const durationSeconds = (Date.now() - startTime) / 1000;

      // Track token usage
      if (response.usage) {
        aiTokensUsed.inc(
          { model: modelId, agent: agentName, type: 'prompt' },
          response.usage.prompt_tokens
        );
        aiTokensUsed.inc(
          { model: modelId, agent: agentName, type: 'completion' },
          response.usage.completion_tokens
        );
      }

      aiAgentDuration.observe(
        { agent: agentName, model: modelId, status: 'success' },
        durationSeconds
      );

      const rawContent = response.choices[0]?.message?.content;

      if (!rawContent) {
        throw new AIError(`${agentName}: Empty response from model`, agentName);
      }

      // Parse JSON (model is in JSON mode, but defensive parse anyway)
      let parsed;
      try {
        parsed = JSON.parse(rawContent);
      } catch (parseErr) {
        throw new AIError(
          `${agentName}: Model returned invalid JSON: ${parseErr.message}`,
          agentName,
          { rawContent: rawContent.slice(0, 500) }
        );
      }

      // Validate against Zod schema if provided
      if (outputSchema) {
        const result = outputSchema.safeParse(parsed);
        if (!result.success) {
          const errors = result.error.flatten().fieldErrors;
          logger.warn({ agent: agentName, errors, attempt }, 'AI output schema validation failed');

          if (attempt === LLM_RETRY_ATTEMPTS) {
            throw new AIError(
              `${agentName}: Output schema validation failed after ${LLM_RETRY_ATTEMPTS} attempts`,
              agentName,
              { schemaErrors: errors }
            );
          }
          // Retry with schema error context
          lastError = new AIError(`Schema validation failed`, agentName);
          continue;
        }
        return result.data;
      }

      return parsed;
    } catch (err) {
      lastError = err;

      // Don't retry on these error types
      if (
        err instanceof AIError ||
        err?.status === 400 || // Bad request — retrying won't help
        err?.status === 401 || // Auth error
        err?.status === 403    // Permission error
      ) {
        break;
      }

      // Rate limit — use retry-after header if available
      if (err?.status === 429) {
        const retryAfter = parseInt(err?.headers?.['retry-after'] || '5') * 1000;
        const delay = Math.min(retryAfter, LLM_RETRY_MAX_DELAY_MS);
        logger.warn({ agent: agentName, delay, attempt }, 'Groq rate limit — waiting');
        await sleep(delay);
        continue;
      }

      // Transient errors — exponential backoff
      if (attempt < LLM_RETRY_ATTEMPTS) {
        const delay = Math.min(
          LLM_RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt - 1),
          LLM_RETRY_MAX_DELAY_MS
        );
        logger.warn({ agent: agentName, err: err.message, delay, attempt }, 'LLM error — retrying');
        await sleep(delay);
      }
    }
  }

  const durationSeconds = (Date.now() - startTime) / 1000;
  aiAgentDuration.observe({ agent: agentName, model: modelId, status: 'failed' }, durationSeconds);
  aiErrorTotal.inc({ agent: agentName, error_type: lastError?.constructor?.name || 'Unknown' });

  logger.error({ agent: agentName, err: lastError }, 'LLM request failed after all retries');

  if (lastError instanceof AIError) throw lastError;
  throw new AIError(
    `${agentName}: LLM request failed — ${lastError?.message || 'Unknown error'}`,
    agentName,
    { originalError: lastError?.message }
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
