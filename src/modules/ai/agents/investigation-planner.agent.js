/**
 * AlertMind — Investigation Planner Agent
 * Stage 7: Generates structured investigation checklist, platform-specific queries,
 *          analyst commands, timeline reconstruction, and actionable recommendations.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmComplete } from '../llm.service.js';
import {
  AGENT_NAME,
  MAX_INVESTIGATION_STEPS,
  MAX_RECOMMENDATIONS,
} from '../../../shared/constants/ai.constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/system/system.prompt.txt'),
  'utf8'
);
const INVESTIGATION_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/investigation/investigation.prompt.txt'),
  'utf8'
);

const checklistItemSchema = z.object({
  step: z.number().int().min(1),
  action: z.string().min(10).max(500),
  purpose: z.string().min(10).max(300),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  estimatedMinutes: z.number().int().min(1).max(60).optional().nullable(),
});

const commandSchema = z.object({
  platform: z.enum(['WINDOWS_CMD', 'POWERSHELL', 'LINUX_BASH', 'SPLUNK_SPL', 'KQL', 'ELASTIC_DSL', 'SQL']),
  purpose: z.string().max(200),
  command: z.string().min(5).max(2000),
  notes: z.string().max(300).optional().nullable(),
});

const recommendationSchema = z.object({
  text: z.string().min(10).max(1000),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  category: z.enum(['CONTAINMENT', 'ERADICATION', 'RECOVERY', 'MONITORING', 'HARDENING', 'ESCALATION', 'DOCUMENTATION']),
  commands: z.array(commandSchema).max(3).optional().nullable(),
});

const timelineEventSchema = z.object({
  timestamp: z.string().optional().nullable(),
  event: z.string().min(5).max(500),
  source: z.string().max(100).optional().nullable(),
});

const investigationPlannerOutputSchema = z.object({
  checklist: z.array(checklistItemSchema).min(3).max(MAX_INVESTIGATION_STEPS),
  commands: z.array(commandSchema).max(15),
  recommendations: z.array(recommendationSchema).min(1).max(MAX_RECOMMENDATIONS),
  timeline: z.array(timelineEventSchema).max(20),
  immediateActions: z.array(z.string().max(300)).max(5),
  escalationTriggers: z.array(z.string().max(300)).max(5),
});

/**
 * @param {Record<string, unknown>} parsedAlert
 * @param {Array<Record<string, unknown>>} entities
 * @param {Array<Record<string, unknown>>} mitreMappings
 * @param {Array<Record<string, unknown>>} hypotheses
 * @returns {Promise<z.infer<typeof investigationPlannerOutputSchema>>}
 */
export async function runInvestigationPlannerAgent(parsedAlert, entities, mitreMappings, hypotheses) {
  const userPrompt = buildPlannerPrompt(parsedAlert, entities, mitreMappings, hypotheses);

  return llmComplete({
    agentName: AGENT_NAME.INVESTIGATION_PLANNER,
    modelTier: 'PRIMARY',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: investigationPlannerOutputSchema,
    temperature: 0.1,
    maxTokens: 6000,
  });
}

function buildPlannerPrompt(parsedAlert, entities, mitreMappings, hypotheses) {
  const mitreList = mitreMappings
    .map((m) => `${m.techniqueId}: ${m.techniqueName}`)
    .join(', ');

  const topHypotheses = hypotheses
    .slice(0, 3)
    .map((h, i) => `H${i + 1} (${Math.round(h.confidence * 100)}%): ${h.text.slice(0, 200)}`)
    .join('\n');

  const hostnameCtx = parsedAlert.hostname ? `Hostname: ${parsedAlert.hostname}` : '';
  const userCtx = parsedAlert.username ? `User: ${parsedAlert.username}` : '';
  const procCtx = parsedAlert.processName ? `Process: ${parsedAlert.processName}` : '';
  const cmdCtx = parsedAlert.commandLine ? `Command: ${parsedAlert.commandLine}` : '';
  const osCtx = parsedAlert.operatingSystem ? `OS: ${parsedAlert.operatingSystem}` : '';

  return `${INVESTIGATION_PROMPT}

ALERT CONTEXT:
${[hostnameCtx, userCtx, procCtx, cmdCtx, osCtx].filter(Boolean).join('\n')}
MITRE Techniques: ${mitreList || 'None identified'}

TOP HYPOTHESES:
${topHypotheses}

TASK:
Generate a complete investigation plan based on the above context.

checklist: Ordered steps the analyst should follow. Each step must:
  - Be specific (not generic like "check logs")
  - Reference actual values from the alert (hostname, user, process)
  - Have a clear purpose explaining why this step matters
  - Include estimated time to complete

commands: Platform-specific commands for investigation. Include:
  - PowerShell or CMD commands for Windows investigation
  - SPL queries if the alert came from Splunk
  - KQL queries if from Sentinel/Defender
  - Elastic DSL if from Elastic
  - Linux bash commands if Linux host
  All commands must reference actual entities from the alert (substitute real values like hostname, username, hash, IP).

recommendations: Actions to take based on findings:
  - CONTAINMENT: Immediate actions to stop active threat (isolate host, block IP, disable account)
  - ERADICATION: Remove the threat (delete malware, remove persistence)
  - RECOVERY: Restore normal operations
  - MONITORING: Additional logging or alerting to set up
  - HARDENING: Security improvements to prevent recurrence
  - ESCALATION: When and who to escalate to
  - DOCUMENTATION: What to document for the incident record

timeline: Reconstruct the sequence of events from the alert evidence.

immediateActions: Top 3-5 actions if the alert is confirmed malicious (prioritized for speed).

escalationTriggers: Conditions that require immediate escalation to senior analyst or CISO.

Return ONLY the JSON object. No other text.`;
}
