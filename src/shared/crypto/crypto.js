/**
 * AlertMind — Cryptographic Utilities
 * AES-256-GCM for symmetric encryption of connector credentials at rest
 * Uses Node.js built-in crypto — no external dependency
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { getConfig } from '../../config/env.js';
import {
  ENCRYPTION_ALGORITHM,
  ENCRYPTION_IV_BYTES,
  ENCRYPTION_AUTH_TAG_BYTES,
} from '../constants/security.constants.js';

/**
 * Returns the encryption key as a 32-byte Buffer.
 * Key stored as 64-char hex string in env.
 */
function getEncryptionKey() {
  const config = getConfig();
  return Buffer.from(config.ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a single string: base64(iv + authTag + ciphertext)
 * This format is self-contained — IV and auth tag travel with the ciphertext.
 *
 * @param {string} plaintext
 * @returns {string} Encrypted string (base64 encoded)
 */
export function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encrypt() requires a string');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: ENCRYPTION_AUTH_TAG_BYTES,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: iv (12 bytes) + authTag (16 bytes) + ciphertext (variable)
  const combined = Buffer.concat([iv, authTag, ciphertext]);
  return combined.toString('base64');
}

/**
 * Decrypts a value encrypted by encrypt().
 * @param {string} encrypted - base64 string from encrypt()
 * @returns {string} Decrypted plaintext
 * @throws If decryption fails (wrong key or tampered ciphertext)
 */
export function decrypt(encrypted) {
  if (typeof encrypted !== 'string') {
    throw new TypeError('decrypt() requires a string');
  }

  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, 'base64');

  // Unpack
  const iv = combined.subarray(0, ENCRYPTION_IV_BYTES);
  const authTag = combined.subarray(ENCRYPTION_IV_BYTES, ENCRYPTION_IV_BYTES + ENCRYPTION_AUTH_TAG_BYTES);
  const ciphertext = combined.subarray(ENCRYPTION_IV_BYTES + ENCRYPTION_AUTH_TAG_BYTES);

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, {
    authTagLength: ENCRYPTION_AUTH_TAG_BYTES,
  });

  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

/**
 * Generates a cryptographically secure random hex string.
 * @param {number} bytes - Number of random bytes (output is 2x this in hex)
 * @returns {string} Hex string
 */
export function randomHex(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generates a cryptographically secure random base64url string.
 * Suitable for tokens, CSRF secrets, session IDs.
 * @param {number} bytes
 * @returns {string}
 */
export function randomBase64url(bytes = 32) {
  return randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates a SHA-256 hash of a string.
 * Used for deterministic key derivation (not for password hashing — use Argon2 for that).
 * @param {string} input
 * @returns {string} Hex hash
 */
export function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Use when comparing tokens, API keys, etc.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Perform comparison anyway to prevent length-based timing attacks
    const dummy = Buffer.from(bufA);
    return false && Buffer.compare(dummy, bufB) === 0;
  }
  return Buffer.compare(bufA, bufB) === 0;
}

/**
 * Encrypts a JSON object.
 * @param {Record<string, unknown>} obj
 * @returns {string}
 */
export function encryptJson(obj) {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypts and parses a JSON object.
 * @template T
 * @param {string} encrypted
 * @returns {T}
 */
export function decryptJson(encrypted) {
  return JSON.parse(decrypt(encrypted));
}
