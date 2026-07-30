/**
 * AlertMind — Secret Generation Utilities
 * Functions for generating cryptographically secure secrets and API keys.
 */

import { randomBytes } from 'node:crypto';
import { API_KEY_PREFIX, API_KEY_BYTES } from '../constants/security.constants.js';

/**
 * Generates a new API key in AlertMind format.
 * Format: am_<64 random hex chars>
 * @returns {string}
 */
export function generateApiKey() {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_BYTES).toString('hex')}`;
}

/**
 * Generates a secure random session token.
 * @param {number} bytes
 * @returns {string} URL-safe base64
 */
export function generateSessionToken(bytes = 32) {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates a secure numeric OTP (for MFA).
 * @param {number} digits
 * @returns {string}
 */
export function generateOTP(digits = 6) {
  const max = Math.pow(10, digits);
  const bytes = randomBytes(4);
  const num = bytes.readUInt32BE(0) % max;
  return String(num).padStart(digits, '0');
}

/**
 * Generates a secure password reset token.
 * @returns {string} 64-char hex token
 */
export function generatePasswordResetToken() {
  return randomBytes(32).toString('hex');
}
