/**
 * AlertMind — Parser Agent
 * Stage 1 of the investigation pipeline.
 * Normalizes raw alert input into a structured AlertMind internal format.
 * Detects: vendor, format, severity, hostname, user, process, network context.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmComplete } from '../llm.service.js';
import { AGENT_NAME } from '../../../shared/constants/ai.constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/system/system.prompt.txt'),
  'utf8'
);

const PARSER_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/parser/parser.prompt.txt'),
  'utf8'
);

// ─── Output Schema ───────────────────────────────────────────────────────────
const parsedAlertSchema = z.object({
  // Detected format and vendor
  inputFormat: z.enum([
    'JSON', 'SYSLOG', 'WINDOWS_EVENT', 'SYSMON', 'SIGMA',
    'WAZUH', 'SPLUNK', 'ELASTIC', 'DEFENDER', 'CROWDSTRIKE',
    'SENTINELONE', 'PLAIN_TEXT', 'CSV',
  ]),
  source: z.enum([
    'MICROSOFT_DEFENDER', 'CROWDSTRIKE', 'SENTINEL', 'SPLUNK',
    'ELASTIC', 'WAZUH', 'AWS_GUARDDUTY', 'GCP_SCC', 'SENTINELONE',
    'SURICATA', 'ZEEK', 'SYSMON', 'MANUAL',
  ]).optional().nullable(),

  // Core alert fields
  alertTitle: z.string().max(500).optional().nullable(),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']).optional().nullable(),
  timestamp: z.string().optional().nullable(),

  // Host context
  hostname: z.string().max(255).optional().nullable(),
  ipAddress: z.string().max(45).optional().nullable(),
  operatingSystem: z.string().max(100).optional().nullable(),

  // User context
  username: z.string().max(255).optional().nullable(),
  domain: z.string().max(255).optional().nullable(),
  privilegeLevel: z.enum(['SYSTEM', 'ADMIN', 'USER', 'SERVICE', 'UNKNOWN']).optional().nullable(),

  // Process context
  processName: z.string().max(255).optional().nullable(),
  processId: z.string().max(20).optional().nullable(),
  parentProcess: z.string().max(255).optional().nullable(),
  commandLine: z.string().max(10000).optional().nullable(),
  workingDirectory: z.string().max(1000).optional().nullable(),

  // Network context
  sourceIp: z.string().max(45).optional().nullable(),
  destinationIp: z.string().max(45).optional().nullable(),
  destinationPort: z.number().int().min(0).max(65535).optional().nullable(),
  protocol: z.string().max(20).optional().nullable(),

  // File context
  filePath: z.string().max(2000).optional().nullable(),
  fileHash: z.string().max(128).optional().nullable(),

  // Registry context (Windows)
  registryKey: z.string().max(2000).optional().nullable(),

  // Alert metadata
  alertId: z.string().max(255).optional().nullable(),
  ruleId: z.string().max(255).optional().nullable(),
  ruleName: z.string().max(500).optional().nullable(),

  // Raw fields that don't fit above
  additionalContext: z.record(z.unknown()).optional().nullable(),

  // Parser confidence
  parseConfidence: z.number().min(0).max(1),
  parseNotes: z.string().max(2000).optional().nullable(),
});

/**
 * Runs the parser agent on raw alert input.
 * @param {string} rawInput - Sanitized raw alert text
 * @returns {Promise<z.infer<typeof parsedAlertSchema>>}
 */
export async function runParserAgent(rawInput) {
  const userPrompt = buildParserPrompt(rawInput);

  const result = await llmComplete({
    agentName: AGENT_NAME.PARSER,
    modelTier: 'FAST',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: parsedAlertSchema,
    temperature: 0.0, // Fully deterministic for parsing
    maxTokens: 2048,
  });

  return result;
}

function buildParserPrompt(rawInput) {
  return `${PARSER_PROMPT}

RAW ALERT INPUT:
\`\`\`
${rawInput}
\`\`\`

Analyze the above alert and return the structured JSON object. Populate only fields for which evidence exists in the alert. Use null for fields with no evidence — do not guess.

Specific instructions:
- Detect the vendor/tool that generated this alert (Microsoft Defender, CrowdStrike, Wazuh, Splunk, etc.)
- Extract the exact severity level as stated in the alert
- If a command line contains Base64 or other encoding, preserve it exactly as-is — decoding happens in the entity extractor
- For Windows Event Logs, map EventID to the alertTitle
- Assign parseConfidence (0.0–1.0) based on how completely you were able to parse the alert

Return ONLY a valid JSON object matching the schema. No other text.`;
}
