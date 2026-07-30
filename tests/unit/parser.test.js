/**
 * AlertMind — Parser Unit Tests
 * Tests the detectAlertFormat() function against all supported formats.
 * No mocks — tests real parsing logic.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectAlertFormat } from '../../src/modules/parser/normalizer.js';
import { ALERT_FORMAT } from '../../src/shared/constants/app.constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '../fixtures');

describe('detectAlertFormat()', () => {

  it('detects Microsoft Defender JSON alert', () => {
    const raw = readFileSync(join(FIXTURES, 'sample-alert.json'), 'utf8');
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.DEFENDER);
  });

  it('detects Sysmon XML alert (Event ID 1)', () => {
    const raw = readFileSync(join(FIXTURES, 'sample-sysmon.xml'), 'utf8');
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.SYSMON);
  });

  it('detects Wazuh/syslog alert', () => {
    const raw = readFileSync(join(FIXTURES, 'sample-syslog.txt'), 'utf8');
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.WAZUH);
  });

  it('detects generic JSON alert', () => {
    const raw = JSON.stringify({ severity: 'High', title: 'Test alert', hostname: 'server1' });
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.JSON);
  });

  it('detects plain text alert', () => {
    const raw = 'CRITICAL: Authentication failure for user admin from 10.0.0.1 at 14:23:40';
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.PLAIN_TEXT);
  });

  it('detects Windows Event XML (non-Sysmon)', () => {
    const raw = `<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">
      <System><EventID>4688</EventID></System>
      <EventData><Data Name="ProcessName">cmd.exe</Data></EventData>
    </Event>`;
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.WINDOWS_EVENT);
  });

  it('detects Sigma rule format', () => {
    const raw = `title: Suspicious PowerShell Encoded Command
status: stable
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    CommandLine|contains: '-EncodedCommand'
  condition: selection`;
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.SIGMA);
  });

  it('detects CrowdStrike alert', () => {
    const raw = JSON.stringify({
      event_type: 'ProcessCreated',
      crowdstrike_id: 'abc123',
      falcon_host_link: 'https://falcon.crowdstrike.com',
      severity: 80,
      ComputerName: 'WORKSTATION-42',
    });
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.CROWDSTRIKE);
  });

  it('returns PLAIN_TEXT for empty-ish input', () => {
    expect(detectAlertFormat('hello world log entry')).toBe(ALERT_FORMAT.PLAIN_TEXT);
  });

  it('handles malformed JSON gracefully (falls through to PLAIN_TEXT)', () => {
    const raw = '{ invalid json {{ not json ';
    const format = detectAlertFormat(raw);
    expect(format).toBe(ALERT_FORMAT.PLAIN_TEXT);
  });

});
