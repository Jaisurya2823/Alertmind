/**
 * AlertMind — Entity Extractor Agent
 * Stage 2 of the investigation pipeline.
 * Extracts all security-relevant entities from the raw alert and parsed alert.
 * Handles: IPs, domains, URLs, hashes, users, hosts, processes, commands,
 *          registry keys, emails, CVEs, Base64/encoded payloads.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmComplete } from '../llm.service.js';
import { AGENT_NAME, MAX_ENTITIES } from '../../../shared/constants/ai.constants.js';
import { ENTITY_TYPE } from '../../../shared/constants/app.constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/system/system.prompt.txt'),
  'utf8'
);

// ─── Output Schema ───────────────────────────────────────────────────────────
const entitySchema = z.object({
  type: z.enum(Object.values(ENTITY_TYPE)),
  value: z.string().min(1).max(2048),
  context: z.string().max(500).optional().nullable(),
  confidence: z.number().min(0).max(1),
  // For encoded values: the decoded content
  decodedValue: z.string().max(10000).optional().nullable(),
  encodingType: z.enum(['BASE64', 'HEX', 'URL_ENCODED', 'UNICODE_ESCAPE', 'NONE']).optional().nullable(),
});

const entityExtractorOutputSchema = z.object({
  entities: z.array(entitySchema).max(MAX_ENTITIES),
  decodedPayloads: z.array(z.object({
    original: z.string().max(2000),
    decoded: z.string().max(50000),
    encodingType: z.string().max(50),
    isSuspicious: z.boolean(),
    suspiciousReason: z.string().max(500).optional().nullable(),
  })).optional().nullable(),
  extractionNotes: z.string().max(2000).optional().nullable(),
});

/**
 * Runs entity extraction on the raw alert.
 * @param {string} rawInput
 * @param {Record<string, unknown>} parsedAlert - Output from parser agent
 * @returns {Promise<z.infer<typeof entityExtractorOutputSchema>>}
 */
export async function runEntityExtractorAgent(rawInput, parsedAlert) {
  const userPrompt = buildEntityExtractorPrompt(rawInput, parsedAlert);

  return llmComplete({
    agentName: AGENT_NAME.ENTITY_EXTRACTOR,
    modelTier: 'FAST',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: entityExtractorOutputSchema,
    temperature: 0.0,
    maxTokens: 4096,
  });
}

function buildEntityExtractorPrompt(rawInput, parsedAlert) {
  return `AGENT ROLE: Security Entity Extractor

Extract ALL security-relevant entities from the alert below.

WHAT TO EXTRACT:
1. IP_ADDRESS — All IPv4 and IPv6 addresses (source, destination, internal, external)
2. DOMAIN — Fully qualified domain names, hostnames used as domains
3. URL — Complete URLs including path and query string
4. FILE_HASH — MD5 (32 hex), SHA1 (40 hex), SHA256 (64 hex)
5. FILE_PATH — Windows (C:\\...) and Linux (/...) file paths
6. USERNAME — User accounts, service accounts, SIDs
7. HOSTNAME — Computer names, NetBIOS names
8. PROCESS — Process names and executables
9. COMMAND — Full command lines (including encoded ones)
10. REGISTRY_KEY — Windows registry paths (HKLM\\..., HKCU\\...)
11. EMAIL — Email addresses
12. CERTIFICATE — Certificate thumbprints or subjects
13. PORT — Port numbers when mentioned independently
14. PROTOCOL — Network protocols (SMB, RDP, HTTP, DNS, etc.)
15. CVE — CVE identifiers (CVE-YYYY-NNNNN format)

BASE64/ENCODING DETECTION:
- Detect Base64 encoded strings (alphabet A-Za-z0-9+/= with length % 4 == 0)
- Common Base64 indicators: PowerShell -enc, -EncodedCommand, FromBase64String
- Decode any detected Base64 and include as decodedValue
- Also detect hex-encoded payloads and URL-encoded strings
- Report decoded content in decodedPayloads array
- Flag as isSuspicious if decoded content contains: invoke-expression, iex, downloadstring, webclient, shellcode, CreateThread, VirtualAlloc

PARSED ALERT CONTEXT (already extracted by parser — use to verify and supplement):
${JSON.stringify(parsedAlert, null, 2)}

RAW ALERT:
\`\`\`
${rawInput}
\`\`\`

RULES:
- Extract every unique occurrence — include duplicates only if context differs
- Confidence 1.0 = regex match with no ambiguity; 0.7 = AI inference; 0.5 = uncertain
- Private IPs (10.x, 172.16-31.x, 192.168.x) are still extracted — do not skip them
- Include the surrounding context (what was the entity doing) in the context field
- Limit total entities to ${MAX_ENTITIES}

Return ONLY the JSON object. No other text.`;
}
