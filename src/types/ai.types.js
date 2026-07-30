/**
 * AlertMind — AI Type Definitions (JSDoc)
 */

/**
 * @typedef {'PRIMARY'|'FAST'} ModelTier
 */

/**
 * @typedef {Object} LLMCompleteOptions
 * @property {string} agentName
 * @property {ModelTier} [modelTier]
 * @property {string} systemPrompt
 * @property {string} userPrompt
 * @property {import('zod').ZodSchema} [outputSchema]
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 */

/**
 * @typedef {Object} AgentResult
 * @property {boolean} success
 * @property {unknown} data
 * @property {number} durationMs
 * @property {string} agentName
 */

/**
 * @typedef {Object} MitreMapping
 * @property {string} techniqueId
 * @property {string} techniqueName
 * @property {string} tacticId
 * @property {string} tacticName
 * @property {string} [subTechniqueId]
 * @property {string} [subTechniqueName]
 * @property {number} confidence
 * @property {string} [reasoning]
 * @property {string} [killChainPhase]
 * @property {string} evidenceFromAlert
 */

/**
 * @typedef {Object} Hypothesis
 * @property {string} text
 * @property {number} confidence
 * @property {string[]} supportingEvidence
 * @property {string[]} contradictingEvidence
 * @property {string} [attackerIntent]
 * @property {string} [nextLikelyAction]
 * @property {string[]} validationQueries
 */

/**
 * @typedef {Object} RiskAssessment
 * @property {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'INFORMATIONAL'} severity
 * @property {number} likelihood
 * @property {number} impact
 * @property {number} confidence
 * @property {string} businessImpact
 * @property {string} justification
 * @property {number} [cvssScore]
 * @property {boolean} requiresImmediateAction
 * @property {number} slaHours
 */

export {};
