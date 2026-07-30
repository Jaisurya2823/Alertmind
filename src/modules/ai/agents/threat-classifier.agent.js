/**
 * AlertMind — Threat Classifier Agent
 * Stage 3: Classifies threat category and generates a plain-English explanation.
 * This explanation is the first thing an analyst reads — it must be clear and accurate.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmComplete } from '../llm.service.js';
import { AGENT_NAME, THREAT_CATEGORIES } from '../../../shared/constants/ai.constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/system/system.prompt.txt'),
  'utf8'
);

const CLASSIFICATION_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/classification/classification.prompt.txt'),
  'utf8'
);

const threatClassifierOutputSchema = z.object({
  threatCategory: z.enum(Object.values(THREAT_CATEGORIES)),
  threatSubCategory: z.string().max(100).optional().nullable(),

  // Plain-English explanation for the analyst — NO jargon assumed
  explanation: z.string().min(50).max(3000),

  // One-sentence executive summary
  oneLiner: z.string().min(10).max(300),

  // Is this likely a true positive or false positive?
  likelyTruePositive: z.boolean(),
  falsePositiveReason: z.string().max(500).optional().nullable(),

  // Attack stage in the kill chain
  killChainStage: z.enum([
    'Reconnaissance',
    'Weaponization',
    'Delivery',
    'Exploitation',
    'Installation',
    'Command and Control',
    'Actions on Objectives',
    'Unknown',
  ]),

  // Known malware families or threat actors if identifiable from alert evidence only
  knownMalwareFamily: z.string().max(100).optional().nullable(),
  threatActorGroup: z.string().max(100).optional().nullable(),

  // Classifier confidence
  confidence: z.number().min(0).max(1),
  classificationNotes: z.string().max(1000).optional().nullable(),
});

/**
 * @param {string} rawInput
 * @param {Record<string, unknown>} parsedAlert
 * @param {Array<Record<string, unknown>>} entities
 * @returns {Promise<z.infer<typeof threatClassifierOutputSchema>>}
 */
export async function runThreatClassifierAgent(rawInput, parsedAlert, entities) {
  const userPrompt = buildClassifierPrompt(rawInput, parsedAlert, entities);

  return llmComplete({
    agentName: AGENT_NAME.THREAT_CLASSIFIER,
    modelTier: 'FAST',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: threatClassifierOutputSchema,
    temperature: 0.05,
    maxTokens: 2048,
  });
}

function buildClassifierPrompt(rawInput, parsedAlert, entities) {
  const entitySummary = entities
    .slice(0, 20)
    .map((e) => `${e.type}: ${e.value}`)
    .join('\n');

  return `${CLASSIFICATION_PROMPT}

PARSED ALERT:
${JSON.stringify(parsedAlert, null, 2)}

EXTRACTED ENTITIES:
${entitySummary || 'None extracted'}

RAW ALERT:
\`\`\`
${rawInput}
\`\`\`

TASK:
1. Classify the threat category using the MITRE ATT&CK tactic that best fits
2. Write a plain-English explanation that a junior SOC analyst can understand without security jargon
   - What happened?
   - Why did this alert fire?
   - What is the potential impact?
   - Why is it suspicious (or why might it be a false positive)?
3. Write a single-sentence one-liner (for dashboards and notifications)
4. Identify the kill chain stage based on available evidence
5. Only identify known malware families or threat actors if the evidence is unambiguous (specific hash, C2 domain, etc.) — do NOT guess

Return ONLY the JSON object. No other text.`;
}
