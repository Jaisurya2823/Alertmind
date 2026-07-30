#!/usr/bin/env node
/**
 * AlertMind — Secret Generator
 * Cross-platform (Windows/Mac/Linux) replacement for the openssl-based setup.
 * Generates every secret required in .env, printed ready to paste.
 *
 * Also fixes a real bug: `openssl genrsa` produces PKCS1 keys
 * ("-----BEGIN RSA PRIVATE KEY-----"), but this project's JWT library
 * (jose, via importPKCS8) requires PKCS8 format
 * ("-----BEGIN PRIVATE KEY-----"). Node's crypto.generateKeyPairSync
 * with `type: 'pkcs8'` produces the correct format directly.
 *
 * Usage: node scripts/generate-secrets.js
 */

import { randomBytes, generateKeyPairSync } from 'node:crypto';

function toEnvLine(pem) {
  // .env stores the PEM as a single line with literal \n sequences.
  // env.js / user.service.js / auth.middleware.js reverse this with
  // .replace(/\\n/g, '\n') when reading the value back out.
  return pem.trim().replace(/\r?\n/g, '\\n');
}

console.log('AlertMind — Generated Secrets');
console.log('Copy each line below into your .env file (replacing the placeholder).');
console.log('═'.repeat(70));
console.log('');

// ─── AUTH_SECRET (64 bytes, base64) ──────────────────────────────────────────
console.log(`AUTH_SECRET=${randomBytes(64).toString('base64')}`);

// ─── CSRF_SECRET (64 bytes, base64) ──────────────────────────────────────────
console.log(`CSRF_SECRET=${randomBytes(64).toString('base64')}`);

// ─── ENCRYPTION_KEY (32 bytes, hex — exactly 64 hex chars) ──────────────────
console.log(`ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`);

// ─── JWT RSA key pair (4096-bit, PKCS8 private / SPKI public) ──────────────
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

console.log(`JWT_PRIVATE_KEY=${toEnvLine(privateKey)}`);
console.log(`JWT_PUBLIC_KEY=${toEnvLine(publicKey)}`);

console.log('');
console.log('═'.repeat(70));
console.log('Done. Paste the 5 lines above into .env, then set GROQ_API_KEY');
console.log('manually (from https://console.groq.com — no CLI generation for this one).');
