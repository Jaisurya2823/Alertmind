/**
 * AlertMind — Risk Assessor Agent
 * Stage 8: Assesses risk severity, likelihood, impact, and business risk.
 * Produces structured risk score with full justification.
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
const RISK_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/risk/risk.prompt.txt'),
  'utf8'
);

const riskAssessorOutputSchema = z.object({
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']),
  likelihood: z.number().min(0).max(1),
  impact: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  cvssScore: z.number().min(0).max(10).optional().nullable(),
  businessImpact: z.string().min(20).max(1000),
  justification: z.string().min(30).max(2000),

  // Risk factors
  riskFactors: z.object({
    assetCriticality: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
    dataAtRisk: z.enum(['SENSITIVE', 'CONFIDENTIAL', 'INTERNAL', 'PUBLIC', 'UNKNOWN']),
    attackerCapability: z.enum(['NATION_STATE', 'ORGANIZED_CRIME', 'HACKTIVIST', 'SCRIPT_KIDDIE', 'INSIDER', 'UNKNOWN']),
    exposureScope: z.enum(['INTERNET_FACING', 'INTERNAL_NETWORK', 'ISOLATED', 'UNKNOWN']),
    accountPrivilege: z.enum(['SYSTEM', 'ADMIN', 'USER', 'SERVICE', 'UNKNOWN']),
    lateralMovementRisk: z.boolean(),
    dataExfiltrationRisk: z.boolean(),
    ransomwareRisk: z.boolean(),
    persistenceDetected: z.boolean(),
  }),

  // Urgency
  requiresImmediateAction: z.boolean(),
  slaHours: z.number().int().min(1).max(720),
  recommendedSLALevel: z.enum(['P1_IMMEDIATE', 'P2_URGENT', 'P3_HIGH', 'P4_MEDIUM', 'P5_LOW']),
});

/**
 * @param {Record<string, unknown>} parsedAlert
 * @param {Array<Record<string, unknown>>} mitreMappings
 * @param {Array<Record<string, unknown>>} hypotheses
 * @param {Record<string, unknown>} threatResult
 * @returns {Promise<z.infer<typeof riskAssessorOutputSchema>>}
 */
export async function runRiskAssessorAgent(parsedAlert, mitreMappings, hypotheses, threatResult) {
  const userPrompt = buildRiskPrompt(parsedAlert, mitreMappings, hypotheses, threatResult);

  return llmComplete({
    agentName: AGENT_NAME.RISK_ASSESSOR,
    modelTier: 'PRIMARY',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: riskAssessorOutputSchema,
    temperature: 0.05,
    maxTokens: 2500,
  });
}

function buildRiskPrompt(parsedAlert, mitreMappings, hypotheses, threatResult) {
  const topHypothesis = hypotheses[0];
  const mitreList = mitreMappings.map((m) => `${m.techniqueId}: ${m.techniqueName}`).join(', ');
  const alertSeverity = parsedAlert.severity || 'UNKNOWN';
  const user = parsedAlert.username || 'UNKNOWN';
  const host = parsedAlert.hostname || 'UNKNOWN';
  const privilege = parsedAlert.privilegeLevel || 'UNKNOWN';

  return `${RISK_PROMPT}

ALERT CONTEXT:
- Alert Severity (vendor-assigned): ${alertSeverity}
- Hostname: ${host}
- Username: ${user}
- Privilege Level: ${privilege}
- Threat Category: ${threatResult.threatCategory}
- Kill Chain Stage: ${threatResult.killChainStage}
- MITRE Techniques: ${mitreList || 'None identified'}

PRIMARY HYPOTHESIS (${Math.round((topHypothesis?.confidence || 0) * 100)}% confidence):
${topHypothesis?.text || 'No hypothesis generated'}

TASK:
Assess the business risk of this alert.

severity: Overall risk severity considering ALL factors (not just the vendor-assigned severity)
likelihood: Probability this is a real attack (0.0 = definitely benign, 1.0 = confirmed attack)
impact: Potential business impact if this is a real attack (0.0 = no impact, 1.0 = catastrophic)
confidence: How confident are you in this risk assessment

businessImpact: Describe the potential business consequences in non-technical language.
  Include: What systems/data could be affected, what business operations could be disrupted,
  regulatory/compliance implications, reputational risk.

justification: Technical justification for the severity rating.
  Reference specific MITRE techniques, host privilege level, network exposure,
  and hypothesis confidence.

riskFactors: Assess each risk dimension from the alert evidence.
  For unknown dimensions (e.g., asset criticality when not in alert), use 'UNKNOWN'.

requiresImmediateAction: True if analyst must act now (during their current shift).

slaHours: Recommended time to resolve in hours (1=P1 immediate, 4=P2 urgent, 8=P3, 24=P4, 168=P5).

SLA MAPPING:
- P1_IMMEDIATE: Active ransomware, confirmed breach, critical system compromised → slaHours: 1
- P2_URGENT: Lateral movement, privilege escalation, C2 detected → slaHours: 4
- P3_HIGH: Credential theft, persistence, suspicious admin activity → slaHours: 8
- P4_MEDIUM: Discovery, reconnaissance, policy violation → slaHours: 24
- P5_LOW: Informational, false positive likely, known benign → slaHours: 168

Return ONLY the JSON object. No other text.`;
}
