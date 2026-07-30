/**
 * AlertMind — Hypothesis Generator Agent
 * Stage 6: Generates 3 ranked hypotheses about what happened.
 * Each hypothesis must be grounded in alert evidence and include a confidence score.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmComplete } from '../llm.service.js';
import {
  AGENT_NAME,
  MAX_HYPOTHESES,
  MIN_HYPOTHESIS_CONFIDENCE,
} from '../../../shared/constants/ai.constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/system/system.prompt.txt'),
  'utf8'
);
const HYPOTHESIS_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/hypothesis/hypothesis.prompt.txt'),
  'utf8'
);

const hypothesisSchema = z.object({
  text: z.string().min(50).max(2000),
  confidence: z.number().min(MIN_HYPOTHESIS_CONFIDENCE).max(1),
  supportingEvidence: z.array(z.string().max(500)).min(1).max(10),
  contradictingEvidence: z.array(z.string().max(500)).max(5),
  attackerIntent: z.string().max(500).optional().nullable(),
  nextLikelyAction: z.string().max(500).optional().nullable(),
  validationQueries: z.array(z.string().max(500)).max(5),
});

const hypothesisGeneratorOutputSchema = z.object({
  hypotheses: z.array(hypothesisSchema).min(1).max(MAX_HYPOTHESES),
  analysisContext: z.string().max(1000).optional().nullable(),
});

/**
 * @param {string} rawInput
 * @param {Record<string, unknown>} parsedAlert
 * @param {Array<Record<string, unknown>>} entities
 * @param {Array<Record<string, unknown>>} mitreMappings
 * @param {Record<string, unknown>} threatResult
 * @returns {Promise<z.infer<typeof hypothesisGeneratorOutputSchema>>}
 */
export async function runHypothesisGeneratorAgent(
  rawInput,
  parsedAlert,
  entities,
  mitreMappings,
  threatResult
) {
  const userPrompt = buildHypothesisPrompt(rawInput, parsedAlert, entities, mitreMappings, threatResult);

  return llmComplete({
    agentName: AGENT_NAME.HYPOTHESIS_GENERATOR,
    modelTier: 'PRIMARY',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: hypothesisGeneratorOutputSchema,
    temperature: 0.1,
    maxTokens: 4000,
  });
}

function buildHypothesisPrompt(rawInput, parsedAlert, entities, mitreMappings, threatResult) {
  const mitreList = mitreMappings
    .map((m) => `${m.techniqueId} (${m.techniqueName}) — ${m.tacticName}`)
    .join('\n');

  const entityList = entities
    .slice(0, 20)
    .map((e) => `${e.type}: ${e.value}`)
    .join('\n');

  return `${HYPOTHESIS_PROMPT}

THREAT CLASSIFICATION:
- Category: ${threatResult.threatCategory}
- Kill Chain Stage: ${threatResult.killChainStage}
- Explanation: ${threatResult.explanation}
- Likely True Positive: ${threatResult.likelyTruePositive}

MITRE ATT&CK MAPPINGS:
${mitreList || 'None identified'}

EXTRACTED ENTITIES:
${entityList || 'None'}

PARSED ALERT:
${JSON.stringify(parsedAlert, null, 2)}

RAW ALERT:
\`\`\`
${rawInput}
\`\`\`

TASK:
Generate exactly ${MAX_HYPOTHESES} hypotheses about what happened in this alert.

Hypothesis 1 must be the MOST LIKELY explanation.
Hypothesis 2 must be an ALTERNATIVE explanation with different attacker intent.
Hypothesis 3 must be the FALSE POSITIVE or BENIGN explanation.

For each hypothesis:
- text: Full narrative explanation (what happened, who, why, how)
- confidence: Probability this hypothesis is correct (all 3 should roughly sum to ≤ 1.0)
- supportingEvidence: Specific observations from the alert that support this hypothesis
- contradictingEvidence: Observations that argue against this hypothesis
- attackerIntent: What was the attacker (or user) trying to achieve
- nextLikelyAction: What would happen next if this hypothesis is correct
- validationQueries: What queries/checks would confirm or deny this hypothesis

Return ONLY the JSON object. No other text.`;
}
