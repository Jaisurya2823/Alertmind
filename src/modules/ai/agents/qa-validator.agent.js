/**
 * AlertMind — QA Validator Agent
 * Stage 10 (Final): Validates the complete pipeline output for consistency,
 * completeness, and accuracy. Flags issues but does not block completion.
 * Results stored in investigation metadata for analyst review.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { llmComplete } from '../llm.service.js';
import { AGENT_NAME } from '../../../shared/constants/ai.constants.js';
import logger from '../../../shared/logger/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../../../prompts/system/system.prompt.txt'),
  'utf8'
);

const qaOutputSchema = z.object({
  passed: z.boolean(),
  overallQualityScore: z.number().min(0).max(1),
  checks: z.array(z.object({
    name: z.string().max(100),
    passed: z.boolean(),
    severity: z.enum(['CRITICAL', 'WARNING', 'INFO']),
    message: z.string().max(500),
  })),
  fabricationRisk: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NONE']),
  fabricationNotes: z.string().max(1000).optional().nullable(),
  recommendations: z.array(z.string().max(300)).max(5),
});

/**
 * Runs QA validation on complete pipeline output.
 * Failures are logged and stored but do NOT block investigation completion.
 *
 * @param {object} fullContext - All pipeline results
 * @param {object} reportResult - Report generator output
 * @returns {Promise<void>}
 */
export async function runQAValidatorAgent(fullContext, reportResult) {
  const { entities, mitreMappings, hypotheses, riskAssessment } = fullContext;

  try {
    const userPrompt = buildQAPrompt(fullContext, reportResult);

    const result = await llmComplete({
      agentName: AGENT_NAME.QA_VALIDATOR,
      modelTier: 'FAST',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      outputSchema: qaOutputSchema,
      temperature: 0.0,
      maxTokens: 2000,
    });

    // Log QA results but don't throw on failure
    if (!result.passed || result.fabricationRisk !== 'NONE') {
      logger.warn(
        {
          passed: result.passed,
          score: result.overallQualityScore,
          fabricationRisk: result.fabricationRisk,
          failedChecks: result.checks.filter((c) => !c.passed),
        },
        'QA validation flagged issues'
      );
    } else {
      logger.info(
        { score: result.overallQualityScore },
        'QA validation passed'
      );
    }

    return result;
  } catch (err) {
    // QA failure must never break the investigation
    logger.warn({ err }, 'QA validator failed — investigation still completed');
    return null;
  }
}

function buildQAPrompt(fullContext, reportResult) {
  const { parsedAlert, explanation, entities, mitreMappings, hypotheses, riskAssessment } = fullContext;

  // Extract IOCs mentioned in report to cross-check against extracted entities
  const extractedValues = entities.map((e) => e.value);
  const mitreIds = mitreMappings.map((m) => m.techniqueId);

  return `AGENT ROLE: QA Validator for AI Security Investigation Output

You are reviewing the complete output of an AI security investigation pipeline for accuracy, consistency, and fabrication risk.

INVESTIGATION OUTPUT SUMMARY:
- Entities extracted: ${entities.length}
- MITRE techniques mapped: ${mitreMappings.length} (${mitreIds.join(', ')})
- Hypotheses generated: ${hypotheses.length}
- Risk Severity: ${riskAssessment?.severity}
- Report length: ${reportResult?.markdownContent?.length || 0} characters

EXECUTIVE SUMMARY (check for non-technical language, no jargon):
${reportResult?.executiveSummary?.slice(0, 500)}

TECHNICAL SUMMARY (check for accuracy and evidence grounding):
${reportResult?.technicalSummary?.slice(0, 500)}

REPORT EXCERPT (check IOC values match extracted entities):
${reportResult?.markdownContent?.slice(0, 2000)}

EXTRACTED ENTITY VALUES (these are the ground truth):
${extractedValues.slice(0, 30).join(', ')}

RUN THE FOLLOWING CHECKS:
1. "mitre_ids_valid" — Are all MITRE technique IDs in format Txxxx or Txxxx.xxx?
2. "ioc_consistency" — Do IOCs in the report match the extracted entities?
3. "confidence_calibration" — Do hypothesis confidences roughly sum to ≤ 1.0?
4. "severity_consistency" — Is severity consistent across risk assessment, executive summary, and technical summary?
5. "no_fabricated_threat_intel" — Report does not contain specific VT scores, AbuseIPDB ratings, or threat actor attributions not in the alert
6. "executive_summary_nontechnical" — Executive summary avoids technical jargon (no CVE IDs, hex strings, process names)
7. "evidence_grounded" — All major claims cite specific alert evidence
8. "hypothesis_coverage" — At least one false positive hypothesis exists

For each failed check, assign severity:
- CRITICAL: Fabricated intelligence, wrong MITRE IDs, major factual errors
- WARNING: Minor inconsistencies, missing sections, calibration issues
- INFO: Style suggestions, completeness improvements

fabricationRisk: Overall assessment of whether AI fabricated facts not in the original alert
- HIGH: Clear fabrication of threat intelligence, hashes, IPs, or attribution
- MEDIUM: Possible extrapolation beyond evidence
- LOW: Minor speculation clearly marked as such
- NONE: All claims grounded in alert evidence

Return ONLY the JSON object. No other text.`;
}
