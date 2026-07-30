/**
 * AlertMind — Prompt Construction Helpers
 * Utilities for building consistent, well-structured prompts for AI agents.
 */

/**
 * Builds a context block for injection into agent prompts.
 * Filters out null/undefined values for clean output.
 *
 * @param {Record<string, unknown>} context
 * @returns {string}
 */
export function buildContextBlock(context) {
  const lines = Object.entries(context)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      const value = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
      return `${label}: ${value}`;
    });
  return lines.join('\n');
}

/**
 * Truncates a value for safe inclusion in a prompt without blowing token budget.
 * @param {unknown} value
 * @param {number} maxChars
 * @returns {string}
 */
export function promptSafeValue(value, maxChars = 2000) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + `\n[... truncated at ${maxChars} chars]`;
}

/**
 * Formats an entity list for prompt injection.
 * @param {Array<{ type: string, value: string }>} entities
 * @param {number} maxEntities
 * @returns {string}
 */
export function formatEntitiesForPrompt(entities, maxEntities = 20) {
  if (!entities?.length) return 'None extracted';
  return entities
    .slice(0, maxEntities)
    .map((e) => `- ${e.type}: ${e.value}${e.context ? ` (${e.context})` : ''}`)
    .join('\n');
}

/**
 * Formats MITRE mappings for prompt injection.
 * @param {Array<{ techniqueId: string, techniqueName: string, tacticName: string, confidence: number }>} mappings
 * @returns {string}
 */
export function formatMitreForPrompt(mappings) {
  if (!mappings?.length) return 'None identified';
  return mappings
    .map((m) => `- ${m.techniqueId}: ${m.techniqueName} [${m.tacticName}] (${Math.round(m.confidence * 100)}%)`)
    .join('\n');
}

/**
 * Wraps content in a labeled section for structured prompt output.
 * @param {string} label
 * @param {string} content
 * @returns {string}
 */
export function promptSection(label, content) {
  return `=== ${label.toUpperCase()} ===\n${content}\n`;
}
