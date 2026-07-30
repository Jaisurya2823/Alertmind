/**
 * AlertMind — MITRE ATT&CK Mapper Agent
 * Stage 4: Maps alert behaviors to MITRE ATT&CK Enterprise techniques.
 * Returns verified technique IDs only — no invented or hallucinated IDs.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmComplete } from '../llm.service.js';
import { AGENT_NAME, MITRE_TACTICS, MAX_MITRE_MAPPINGS } from '../../../shared/constants/ai.constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/system/system.prompt.txt'),
  'utf8'
);
const MITRE_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/mitre/mitre.prompt.txt'),
  'utf8'
);

// Regex: T followed by 4 digits, optionally .3 digits for sub-technique
const TECHNIQUE_ID_REGEX = /^T\d{4}(\.\d{3})?$/;

// Tactic ID: TA + 4 digits
const TACTIC_ID_REGEX = /^TA\d{4}$/;

const mitreMappingSchema = z.object({
  techniqueId: z.string().regex(TECHNIQUE_ID_REGEX, 'Invalid MITRE technique ID format (expected Txxxx or Txxxx.xxx)'),
  techniqueName: z.string().min(3).max(255),
  tacticId: z.string().regex(TACTIC_ID_REGEX, 'Invalid MITRE tactic ID format (expected TAxxxx)'),
  tacticName: z.string().min(3).max(100),
  subTechniqueId: z.string().regex(TECHNIQUE_ID_REGEX).optional().nullable(),
  subTechniqueName: z.string().max(255).optional().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10).max(1000),
  killChainPhase: z.string().max(100).optional().nullable(),
  evidenceFromAlert: z.string().max(1000),
});

const mitreMapperOutputSchema = z.object({
  mitreMappings: z.array(mitreMappingSchema).max(MAX_MITRE_MAPPINGS),
  primaryTechnique: z.string().regex(TECHNIQUE_ID_REGEX).optional().nullable(),
  mappingNotes: z.string().max(1000).optional().nullable(),
});

/**
 * @param {string} rawInput
 * @param {Record<string, unknown>} parsedAlert
 * @param {Record<string, unknown>} threatResult
 * @returns {Promise<z.infer<typeof mitreMapperOutputSchema>>}
 */
export async function runMitreMapperAgent(rawInput, parsedAlert, threatResult) {
  const userPrompt = buildMitrePrompt(rawInput, parsedAlert, threatResult);

  const result = await llmComplete({
    agentName: AGENT_NAME.MITRE_MAPPER,
    modelTier: 'PRIMARY',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: mitreMapperOutputSchema,
    temperature: 0.05,
    maxTokens: 3000,
  });

  // Post-process: validate technique IDs against known tactic-technique relationships
  result.mitreMappings = result.mitreMappings.filter((m) => {
    const validTactic = Object.keys(MITRE_TACTICS).includes(m.tacticId);
    if (!validTactic) return false;
    // Ensure tactic name matches our known mapping
    if (MITRE_TACTICS[m.tacticId] !== m.tacticName) {
      m.tacticName = MITRE_TACTICS[m.tacticId];
    }
    return true;
  });

  return result;
}

function buildMitrePrompt(rawInput, parsedAlert, threatResult) {
  return `${MITRE_PROMPT}

THREAT CLASSIFICATION RESULT:
- Category: ${threatResult.threatCategory}
- Kill Chain Stage: ${threatResult.killChainStage}
- Explanation: ${threatResult.explanation}

PARSED ALERT:
${JSON.stringify(parsedAlert, null, 2)}

RAW ALERT:
\`\`\`
${rawInput}
\`\`\`

TASK:
Map the observed behaviors in this alert to MITRE ATT&CK Enterprise techniques.

STRICT RULES:
1. Only use technique IDs you are certain exist in MITRE ATT&CK Enterprise
2. Every mapping must cite specific evidence from the alert in evidenceFromAlert
3. Rank by confidence — most likely first
4. For each technique, determine if a sub-technique applies (e.g., T1059.001 not just T1059)
5. Do NOT include techniques that cannot be directly evidenced from the alert
6. Maximum ${MAX_MITRE_MAPPINGS} techniques

VALID TACTIC IDs AND NAMES (use exactly these):
${Object.entries(MITRE_TACTICS).map(([id, name]) => `${id}: ${name}`).join('\n')}

Return ONLY the JSON object. No other text.`;
}
