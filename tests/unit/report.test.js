/**
 * AlertMind — Report Unit Tests
 * Tests formatters, sanitizers, and report structure validators.
 */

import { describe, it, expect } from 'vitest';
import {
  formatConfidence,
  formatSeverity,
  formatProcessingTime,
  formatMitreTechnique,
  truncate,
  formatSLA,
  maskSensitive,
} from '../../src/shared/helpers/formatters.js';

describe('formatConfidence()', () => {
  it('formats 0.87 as 87%', () => expect(formatConfidence(0.87)).toBe('87%'));
  it('formats 1.0 as 100%', () => expect(formatConfidence(1.0)).toBe('100%'));
  it('formats 0.0 as 0%', () => expect(formatConfidence(0.0)).toBe('0%'));
  it('rounds correctly', () => expect(formatConfidence(0.555)).toBe('56%'));
});

describe('formatSeverity()', () => {
  it('formats CRITICAL', () => expect(formatSeverity('CRITICAL')).toBe('Critical'));
  it('formats HIGH', () => expect(formatSeverity('HIGH')).toBe('High'));
  it('formats MEDIUM', () => expect(formatSeverity('MEDIUM')).toBe('Medium'));
  it('formats LOW', () => expect(formatSeverity('LOW')).toBe('Low'));
  it('formats INFORMATIONAL', () => expect(formatSeverity('INFORMATIONAL')).toBe('Informational'));
  it('handles lowercase input', () => expect(formatSeverity('critical')).toBe('Critical'));
  it('handles null gracefully', () => expect(formatSeverity(null)).toBe('Unknown'));
});

describe('formatProcessingTime()', () => {
  it('formats null as N/A', () => expect(formatProcessingTime(null)).toBe('N/A'));
  it('formats under 60s in seconds', () => expect(formatProcessingTime(45200)).toBe('45.2s'));
  it('formats over 60s in minutes', () => expect(formatProcessingTime(83000)).toBe('1m 23s'));
  it('formats zero', () => expect(formatProcessingTime(0)).toBe('N/A'));
});

describe('formatMitreTechnique()', () => {
  it('formats technique with name', () => {
    const result = formatMitreTechnique('T1059.001', 'PowerShell');
    expect(result).toBe('T1059.001 — PowerShell');
  });
});

describe('truncate()', () => {
  it('returns full string when under limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  it('truncates with ellipsis when over limit', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });
  it('handles null/empty', () => {
    expect(truncate(null)).toBe('');
    expect(truncate('')).toBe('');
  });
});

describe('formatSLA()', () => {
  it('formats P1 correctly', () => {
    expect(formatSLA('P1_IMMEDIATE', 1)).toContain('P1');
  });
  it('formats P5 correctly', () => {
    expect(formatSLA('P5_LOW', 168)).toContain('P5');
  });
  it('falls back for unknown level', () => {
    expect(formatSLA('UNKNOWN', 48)).toContain('48h');
  });
});

describe('maskSensitive()', () => {
  it('masks middle of string', () => {
    const result = maskSensitive('gsk_abcdef1234567890');
    expect(result).toContain('gsk_');
    expect(result).toContain('****');
    expect(result).not.toContain('abcdef12345');
  });
  it('returns [REDACTED] for short strings', () => {
    expect(maskSensitive('abc')).toBe('[REDACTED]');
  });
  it('returns [REDACTED] for null', () => {
    expect(maskSensitive(null)).toBe('[REDACTED]');
  });
});
