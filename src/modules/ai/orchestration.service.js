/**
 * AlertMind — AI Orchestration Service
 * Coordinates the full investigation pipeline in sequence.
 * Each agent receives prior agents' output as enriched context.
 *
 * Pipeline:
 * PARSER → ENTITY_EXTRACTOR → THREAT_CLASSIFIER → MITRE_MAPPER →
 * IOC_ENRICHER → HYPOTHESIS_GENERATOR → INVESTIGATION_PLANNER →
 * RISK_ASSESSOR → REPORT_GENERATOR → QA_VALIDATOR
 */

import { getPrismaClient } from '../../bootstrap/startup.js';
import { runParserAgent } from './agents/parser.agent.js';
import { runEntityExtractorAgent } from './agents/entity-extractor.agent.js';
import { runThreatClassifierAgent } from './agents/threat-classifier.agent.js';
import { runMitreMapperAgent } from './agents/mitre-mapper.agent.js';
import { runHypothesisGeneratorAgent } from './agents/hypothesis-generator.agent.js';
import { runInvestigationPlannerAgent } from './agents/investigation-planner.agent.js';
import { runRiskAssessorAgent } from './agents/risk-assessor.agent.js';
import { runReportGeneratorAgent } from './agents/report-generator.agent.js';
import { runQAValidatorAgent } from './agents/qa-validator.agent.js';
import logger from '../../shared/logger/logger.js';
import { aiAnalysisDuration, activeInvestigations, investigationsTotal } from '../../shared/metrics/metrics.js';
import { INVESTIGATION_STATUS, ALERT_STATUS } from '../../shared/constants/app.constants.js';
import { AIError } from '../../shared/errors/ai.error.js';
import { addBreadcrumb } from '../../shared/telemetry/telemetry.js';
import { truncateForAI } from '../../shared/validation/sanitize.js';

/**
 * Executes the full AI investigation pipeline for a given alert.
 *
 * @param {object} params
 * @param {string} params.investigationId
 * @param {string} params.alertId
 * @param {string} params.rawInput - Sanitized raw alert text
 * @returns {Promise<void>}
 */
export async function runInvestigationPipeline({ investigationId, alertId, rawInput }) {
  const prisma = getPrismaClient();
  const startTime = Date.now();

  activeInvestigations.inc();

  logger.info({ investigationId, alertId }, 'Investigation pipeline starting');
  addBreadcrumb('Investigation pipeline started', { investigationId });

  try {
    // ─── Mark investigation as IN_PROGRESS ──────────────────────────────
    await prisma.investigation.update({
      where: { id: investigationId },
      data: { status: INVESTIGATION_STATUS.IN_PROGRESS },
    });

    await prisma.alert.update({
      where: { id: alertId },
      data: { status: ALERT_STATUS.PROCESSING },
    });

    // Truncate for AI if necessary
    const aiInput = truncateForAI(rawInput);

    // ─── Stage 1: Parse & Normalize ──────────────────────────────────────
    logger.info({ investigationId, stage: 'PARSER' }, 'Running parser agent');
    const parsedAlert = await runParserAgent(aiInput);

    await prisma.investigation.update({
      where: { id: investigationId },
      data: {
        parsedAlert,
        modelUsed: 'llama-3.1-8b-instant',
      },
    });

    // ─── Stage 2: Entity Extraction ──────────────────────────────────────
    logger.info({ investigationId, stage: 'ENTITY_EXTRACTOR' }, 'Running entity extractor');
    const entityResult = await runEntityExtractorAgent(aiInput, parsedAlert);

    if (entityResult.entities.length > 0) {
      await prisma.extractedEntity.createMany({
        data: entityResult.entities.map((e) => ({
          investigationId,
          type: e.type,
          value: e.value,
          context: e.context || null,
          confidence: e.confidence || null,
        })),
        skipDuplicates: true,
      });
    }

    // ─── Stage 3: Threat Classification ──────────────────────────────────
    logger.info({ investigationId, stage: 'THREAT_CLASSIFIER' }, 'Running threat classifier');
    const threatResult = await runThreatClassifierAgent(aiInput, parsedAlert, entityResult.entities);

    await prisma.investigation.update({
      where: { id: investigationId },
      data: {
        threatCategory: threatResult.threatCategory,
        explanation: threatResult.explanation,
      },
    });

    // ─── Stage 4: MITRE ATT&CK Mapping ───────────────────────────────────
    logger.info({ investigationId, stage: 'MITRE_MAPPER' }, 'Running MITRE mapper');
    const mitreResult = await runMitreMapperAgent(aiInput, parsedAlert, threatResult);

    if (mitreResult.mitreMappings.length > 0) {
      await prisma.mitreMapping.createMany({
        data: mitreResult.mitreMappings.map((m) => ({
          investigationId,
          techniqueId: m.techniqueId,
          techniqueName: m.techniqueName,
          tacticId: m.tacticId,
          tacticName: m.tacticName,
          subTechniqueId: m.subTechniqueId || null,
          subTechniqueName: m.subTechniqueName || null,
          confidence: m.confidence,
          reasoning: m.reasoning || null,
          killChainPhase: m.killChainPhase || null,
        })),
        skipDuplicates: true,
      });
    }

    // ─── Stage 5: IOC Storage ─────────────────────────────────────────────
    // IOCs are derived from entity extraction — flag those that appear malicious
    // Real enrichment via external TI APIs (VirusTotal, etc.) handled by connector module
    const iocEntities = entityResult.entities.filter((e) =>
      ['IP_ADDRESS', 'DOMAIN', 'URL', 'MD5', 'SHA1', 'SHA256', 'EMAIL'].includes(e.type)
    );

    if (iocEntities.length > 0) {
      const iocTypeMap = {
        IP_ADDRESS: 'IP_ADDRESS',
        DOMAIN: 'DOMAIN',
        URL: 'URL',
        MD5: 'MD5',
        SHA1: 'SHA1',
        SHA256: 'SHA256',
        EMAIL: 'EMAIL',
        FILENAME: 'FILENAME',
        REGISTRY_KEY: 'REGISTRY_KEY',
      };

      await prisma.iOC.createMany({
        data: iocEntities
          .filter((e) => iocTypeMap[e.type])
          .map((e) => ({
            investigationId,
            type: iocTypeMap[e.type],
            value: e.value,
            tlp: 'AMBER',
          })),
        skipDuplicates: true,
      });
    }

    // ─── Stage 6: Hypothesis Generation ──────────────────────────────────
    logger.info({ investigationId, stage: 'HYPOTHESIS_GENERATOR' }, 'Running hypothesis generator');
    const hypothesisResult = await runHypothesisGeneratorAgent(
      aiInput, parsedAlert, entityResult.entities, mitreResult.mitreMappings, threatResult
    );

    if (hypothesisResult.hypotheses.length > 0) {
      await prisma.hypothesis.createMany({
        data: hypothesisResult.hypotheses.map((h, idx) => ({
          investigationId,
          text: h.text,
          confidence: h.confidence,
          evidence: h.evidence || null,
          ordering: idx,
        })),
      });
    }

    // ─── Stage 7: Investigation Planning ─────────────────────────────────
    logger.info({ investigationId, stage: 'INVESTIGATION_PLANNER' }, 'Running investigation planner');
    const plannerResult = await runInvestigationPlannerAgent(
      parsedAlert, entityResult.entities, mitreResult.mitreMappings, hypothesisResult.hypotheses
    );

    if (plannerResult.timeline?.length > 0) {
      await prisma.timelineEvent.createMany({
        data: plannerResult.timeline.map((t, idx) => ({
          investigationId,
          event: t.event,
          source: t.source || null,
          eventTimestamp: t.timestamp ? new Date(t.timestamp) : null,
          ordering: idx,
        })),
      });
    }

    // ─── Stage 8: Risk Assessment ─────────────────────────────────────────
    logger.info({ investigationId, stage: 'RISK_ASSESSOR' }, 'Running risk assessor');
    const riskResult = await runRiskAssessorAgent(
      parsedAlert, mitreResult.mitreMappings, hypothesisResult.hypotheses, threatResult
    );

    await prisma.riskAssessment.create({
      data: {
        investigationId,
        severity: riskResult.severity,
        likelihood: riskResult.likelihood,
        impact: riskResult.impact,
        confidence: riskResult.confidence,
        businessImpact: riskResult.businessImpact || null,
        justification: riskResult.justification || null,
        cvssScore: riskResult.cvssScore || null,
      },
    });

    if (plannerResult.recommendations?.length > 0) {
      await prisma.recommendation.createMany({
        data: plannerResult.recommendations.map((r, idx) => ({
          investigationId,
          text: r.text,
          priority: r.priority,
          category: r.category,
          commands: r.commands || null,
          ordering: idx,
        })),
      });
    }

    // ─── Stage 9: Report Generation ──────────────────────────────────────
    logger.info({ investigationId, stage: 'REPORT_GENERATOR' }, 'Running report generator');

    // Assemble full context for report
    const fullContext = {
      parsedAlert,
      explanation: threatResult.explanation,
      threatCategory: threatResult.threatCategory,
      entities: entityResult.entities,
      mitreMappings: mitreResult.mitreMappings,
      hypotheses: hypothesisResult.hypotheses,
      checklist: plannerResult.checklist,
      recommendations: plannerResult.recommendations,
      riskAssessment: riskResult,
    };

    const reportResult = await runReportGeneratorAgent(fullContext);

    await prisma.report.create({
      data: {
        investigationId,
        executiveSummary: reportResult.executiveSummary,
        technicalSummary: reportResult.technicalSummary,
        markdownContent: reportResult.markdownContent,
      },
    });

    // ─── Stage 10: QA Validation ──────────────────────────────────────────
    logger.info({ investigationId, stage: 'QA_VALIDATOR' }, 'Running QA validator');
    await runQAValidatorAgent(fullContext, reportResult);

    // ─── Finalize ─────────────────────────────────────────────────────────
    const processingTimeMs = Date.now() - startTime;

    await prisma.investigation.update({
      where: { id: investigationId },
      data: {
        status: INVESTIGATION_STATUS.COMPLETED,
        processingTimeMs,
      },
    });

    await prisma.alert.update({
      where: { id: alertId },
      data: { status: ALERT_STATUS.COMPLETED },
    });

    const durationSeconds = processingTimeMs / 1000;
    aiAnalysisDuration.observe(
      { model: 'llama-3.3-70b-versatile', status: 'success' },
      durationSeconds
    );
    investigationsTotal.inc({
      status: 'completed',
      severity: riskResult.severity,
      source: parsedAlert.source || 'MANUAL',
    });

    logger.info(
      { investigationId, durationMs: processingTimeMs },
      'Investigation pipeline completed'
    );
  } catch (err) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error({ err, investigationId, alertId }, 'Investigation pipeline failed');

    await prisma.investigation
      .update({
        where: { id: investigationId },
        data: {
          status: INVESTIGATION_STATUS.FAILED,
          errorMessage,
          processingTimeMs,
        },
      })
      .catch((updateErr) =>
        logger.error({ updateErr }, 'Failed to update investigation status after error')
      );

    await prisma.alert
      .update({
        where: { id: alertId },
        data: { status: ALERT_STATUS.FAILED },
      })
      .catch(() => {});

    aiAnalysisDuration.observe(
      { model: 'llama-3.3-70b-versatile', status: 'failed' },
      processingTimeMs / 1000
    );
    investigationsTotal.inc({ status: 'failed', severity: 'UNKNOWN', source: 'UNKNOWN' });

    throw err;
  } finally {
    activeInvestigations.dec();
  }
}
