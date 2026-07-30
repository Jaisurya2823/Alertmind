/**
 * AlertMind — AI Pipeline Constants
 * Groq model IDs, agent names, pipeline stages, output schemas
 */

export const GROQ_MODELS = Object.freeze({
  PRIMARY: 'llama-3.3-70b-versatile',
  FAST: 'llama-3.1-8b-instant',
});

// Which model to use per agent
// Fast model for deterministic extraction tasks; primary model for reasoning tasks
export const AGENT_MODEL_MAP = Object.freeze({
  PARSER: 'FAST',
  ENTITY_EXTRACTOR: 'FAST',
  MITRE_MAPPER: 'PRIMARY',
  THREAT_CLASSIFIER: 'FAST',
  IOC_ENRICHER: 'FAST',
  HYPOTHESIS_GENERATOR: 'PRIMARY',
  INVESTIGATION_PLANNER: 'PRIMARY',
  RISK_ASSESSOR: 'PRIMARY',
  REPORT_GENERATOR: 'PRIMARY',
  QA_VALIDATOR: 'FAST',
});

export const AGENT_NAME = Object.freeze({
  PARSER: 'PARSER',
  ENTITY_EXTRACTOR: 'ENTITY_EXTRACTOR',
  MITRE_MAPPER: 'MITRE_MAPPER',
  THREAT_CLASSIFIER: 'THREAT_CLASSIFIER',
  IOC_ENRICHER: 'IOC_ENRICHER',
  HYPOTHESIS_GENERATOR: 'HYPOTHESIS_GENERATOR',
  INVESTIGATION_PLANNER: 'INVESTIGATION_PLANNER',
  RISK_ASSESSOR: 'RISK_ASSESSOR',
  REPORT_GENERATOR: 'REPORT_GENERATOR',
  QA_VALIDATOR: 'QA_VALIDATOR',
});

// Ordered pipeline stages — order is enforced by the orchestrator
export const PIPELINE_STAGES = Object.freeze([
  'PARSER',
  'ENTITY_EXTRACTOR',
  'THREAT_CLASSIFIER',
  'MITRE_MAPPER',
  'IOC_ENRICHER',
  'HYPOTHESIS_GENERATOR',
  'INVESTIGATION_PLANNER',
  'RISK_ASSESSOR',
  'REPORT_GENERATOR',
  'QA_VALIDATOR',
]);

export const THREAT_CATEGORIES = Object.freeze({
  INITIAL_ACCESS: 'Initial Access',
  EXECUTION: 'Execution',
  PERSISTENCE: 'Persistence',
  PRIVILEGE_ESCALATION: 'Privilege Escalation',
  DEFENSE_EVASION: 'Defense Evasion',
  CREDENTIAL_ACCESS: 'Credential Access',
  DISCOVERY: 'Discovery',
  LATERAL_MOVEMENT: 'Lateral Movement',
  COLLECTION: 'Collection',
  COMMAND_AND_CONTROL: 'Command and Control',
  EXFILTRATION: 'Exfiltration',
  IMPACT: 'Impact',
  RECONNAISSANCE: 'Reconnaissance',
  RESOURCE_DEVELOPMENT: 'Resource Development',
  UNKNOWN: 'Unknown',
});

export const MITRE_TACTICS = Object.freeze({
  TA0001: 'Initial Access',
  TA0002: 'Execution',
  TA0003: 'Persistence',
  TA0004: 'Privilege Escalation',
  TA0005: 'Defense Evasion',
  TA0006: 'Credential Access',
  TA0007: 'Discovery',
  TA0008: 'Lateral Movement',
  TA0009: 'Collection',
  TA0010: 'Exfiltration',
  TA0011: 'Command and Control',
  TA0040: 'Impact',
  TA0042: 'Resource Development',
  TA0043: 'Reconnaissance',
});

// AI output must conform to these structures
// Validated by QA_VALIDATOR agent before persistence
export const REQUIRED_PIPELINE_OUTPUT_FIELDS = Object.freeze({
  PARSER: ['parsedAlert', 'inputFormat', 'source', 'severity', 'timestamp'],
  ENTITY_EXTRACTOR: ['entities'],
  THREAT_CLASSIFIER: ['threatCategory', 'explanation'],
  MITRE_MAPPER: ['mitreMappings'],
  HYPOTHESIS_GENERATOR: ['hypotheses'],
  INVESTIGATION_PLANNER: ['checklist', 'commands'],
  RISK_ASSESSOR: ['riskAssessment'],
  REPORT_GENERATOR: ['report'],
});

export const MAX_HYPOTHESES = 3;
export const MIN_HYPOTHESIS_CONFIDENCE = 0.05;
export const MAX_INVESTIGATION_STEPS = 15;
export const MAX_RECOMMENDATIONS = 10;
export const MAX_MITRE_MAPPINGS = 5;
export const MAX_ENTITIES = 50;
export const MAX_IOCS = 30;

// Retry configuration for LLM calls
export const LLM_RETRY_ATTEMPTS = 3;
export const LLM_RETRY_INITIAL_DELAY_MS = 1000;
export const LLM_RETRY_MAX_DELAY_MS = 10_000;

// If AI output fails JSON parsing or QA validation, we retry
export const LLM_OUTPUT_VALIDATION_RETRIES = 2;

// Max characters of raw alert to send to AI
// Prevents token overflow and cost explosion
export const MAX_ALERT_CHARS_FOR_AI = 50_000;
