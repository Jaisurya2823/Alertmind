/**
 * AlertMind — AI Error Class
 */

import { AppError } from './app.error.js';
import { HTTP_STATUS } from '../constants/app.constants.js';

export class AIError extends AppError {
  /**
   * @param {string} message
   * @param {string} [agentName]
   * @param {Record<string, unknown>} [context]
   */
  constructor(message, agentName = 'UNKNOWN', context = {}) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'AI_PIPELINE_ERROR', context);
    this.agentName = agentName;
  }
}

export class AITimeoutError extends AIError {
  constructor(agentName, timeoutMs) {
    super(`Agent ${agentName} timed out after ${timeoutMs}ms`, agentName);
    this.code = 'AI_TIMEOUT';
  }
}

export class AIOutputValidationError extends AIError {
  constructor(agentName, fieldErrors) {
    super(`Agent ${agentName} produced invalid output`, agentName, { fieldErrors });
    this.code = 'AI_OUTPUT_INVALID';
    this.fieldErrors = fieldErrors;
  }
}
