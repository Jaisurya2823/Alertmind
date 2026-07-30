/**
 * AlertMind — AI & Utility Unit Tests
 * Tests sanitizeAlertInput, encryption, and AI constants.
 * No AI API calls — tests utility functions only.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeAlertInput, truncateForAI } from '../../src/shared/validation/sanitize.js';
import { encrypt, decrypt, encryptJson, decryptJson, randomHex, sha256 } from '../../src/shared/crypto/crypto.js';
import { MAX_ALERT_CHARS_FOR_AI } from '../../src/shared/constants/ai.constants.js';

describe('sanitizeAlertInput()', () => {

  it('removes null bytes', () => {
    const input = 'alert\0data\0here';
    expect(sanitizeAlertInput(input)).toBe('alertdatahere');
  });

  it('trims whitespace', () => {
    const input = '   {"severity":"High"}   ';
    expect(sanitizeAlertInput(input)).toBe('{"severity":"High"}');
  });

  it('preserves newlines and tabs', () => {
    const input = 'line1\nline2\ttabbed';
    expect(sanitizeAlertInput(input)).toBe('line1\nline2\ttabbed');
  });

  it('throws TypeError for non-string input', () => {
    expect(() => sanitizeAlertInput(null)).toThrow(TypeError);
    expect(() => sanitizeAlertInput(123)).toThrow(TypeError);
    expect(() => sanitizeAlertInput({})).toThrow(TypeError);
  });

  it('handles alert at exactly MAX size without throwing', () => {
    const bigInput = 'A'.repeat(1024 * 1024); // 1MB
    expect(() => sanitizeAlertInput(bigInput)).not.toThrow();
  });

});

describe('truncateForAI()', () => {

  it('returns input unchanged when under limit', () => {
    const input = '{"test": "data"}';
    expect(truncateForAI(input)).toBe(input);
  });

  it('truncates and adds marker when over limit', () => {
    const bigInput = 'X'.repeat(MAX_ALERT_CHARS_FOR_AI + 100);
    const result = truncateForAI(bigInput);
    expect(result.length).toBeLessThan(bigInput.length);
    expect(result).toContain('[TRUNCATED');
  });

});

describe('encrypt() / decrypt()', () => {

  it('encrypts and decrypts a string correctly', () => {
    const plaintext = 'sensitive-connector-credential-value';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const plaintext = 'same-value';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2); // Different IVs
    // But both decrypt to the same value
    expect(decrypt(enc1)).toBe(plaintext);
    expect(decrypt(enc2)).toBe(plaintext);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('test');
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    expect(() => decrypt(tampered)).toThrow();
  });

  it('handles unicode content', () => {
    const text = '{"host": "сервер-42", "user": "用户名"}';
    expect(decrypt(encrypt(text))).toBe(text);
  });

  it('throws TypeError for non-string input', () => {
    expect(() => encrypt(123)).toThrow(TypeError);
    expect(() => decrypt(null)).toThrow(TypeError);
  });

});

describe('encryptJson() / decryptJson()', () => {

  it('encrypts and decrypts JSON object', () => {
    const obj = { host: 'splunk.corp.local', token: 'abc123', port: 8088 };
    const encrypted = encryptJson(obj);
    const decrypted = decryptJson(encrypted);
    expect(decrypted).toEqual(obj);
  });

});

describe('randomHex()', () => {

  it('generates correct length hex string', () => {
    expect(randomHex(16)).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(randomHex(32)).toHaveLength(64);
  });

  it('generates different values each call', () => {
    expect(randomHex()).not.toBe(randomHex());
  });

  it('only contains hex characters', () => {
    expect(randomHex(32)).toMatch(/^[0-9a-f]+$/);
  });

});

describe('sha256()', () => {

  it('produces consistent hash for same input', () => {
    expect(sha256('test-api-key')).toBe(sha256('test-api-key'));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256('key-a')).not.toBe(sha256('key-b'));
  });

  it('returns 64-char hex string', () => {
    expect(sha256('anything')).toHaveLength(64);
    expect(sha256('anything')).toMatch(/^[0-9a-f]+$/);
  });

});
