/**
 * AlertMind — MITRE Unit Tests
 * Tests MITRE technique ID format validation and tactic mapping consistency.
 */

import { describe, it, expect } from 'vitest';
import { MITRE_TACTICS } from '../../src/shared/constants/ai.constants.js';

const TECHNIQUE_ID_REGEX = /^T\d{4}(\.\d{3})?$/;
const TACTIC_ID_REGEX = /^TA\d{4}$/;

describe('MITRE ATT&CK constants', () => {

  it('all tactic IDs match TA\\d{4} format', () => {
    const ids = Object.keys(MITRE_TACTICS);
    ids.forEach((id) => {
      expect(id, `Tactic ID "${id}" must match TA\\d{4}`).toMatch(TACTIC_ID_REGEX);
    });
  });

  it('all tactic names are non-empty strings', () => {
    Object.values(MITRE_TACTICS).forEach((name) => {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  it('contains all 14 enterprise ATT&CK tactics', () => {
    expect(Object.keys(MITRE_TACTICS)).toHaveLength(14);
  });

  it('contains TA0002 (Execution)', () => {
    expect(MITRE_TACTICS['TA0002']).toBe('Execution');
  });

  it('contains TA0040 (Impact)', () => {
    expect(MITRE_TACTICS['TA0040']).toBe('Impact');
  });

});

describe('Technique ID format validation', () => {

  it('validates correct technique IDs', () => {
    const validIds = ['T1059', 'T1059.001', 'T1486', 'T1003.001', 'T1071.004'];
    validIds.forEach((id) => {
      expect(id, `${id} should be valid`).toMatch(TECHNIQUE_ID_REGEX);
    });
  });

  it('rejects invalid technique IDs', () => {
    const invalidIds = ['t1059', 'T1059.', 'TA1059', 'T10590', 'T1059.0001', 'abc'];
    invalidIds.forEach((id) => {
      expect(id, `${id} should be invalid`).not.toMatch(TECHNIQUE_ID_REGEX);
    });
  });

});
