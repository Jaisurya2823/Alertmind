# AlertMind — User Guide

## What is AlertMind?

AlertMind transforms any security alert into a complete AI-powered investigation in under 60 seconds. Paste an alert from Defender, CrowdStrike, Splunk, or any other source — AlertMind explains what happened, maps it to MITRE ATT&CK, extracts indicators of compromise, generates hypotheses, and produces a ready-to-share incident report.

## Getting Started

1. **Sign up** at your organization's AlertMind URL
2. You'll automatically get a default workspace
3. Paste or upload your first alert

## Submitting an Alert

### Paste Mode
1. Copy the raw alert (JSON, XML, syslog, or plain text) from your security tool
2. Paste it into the text box on the home screen
3. Click **Analyze Alert**

### Upload Mode
1. Click the **Upload File** tab
2. Drag and drop or click to browse for your alert file
3. Supported formats: `.json`, `.txt`, `.log`, `.xml`, `.csv` (max 10MB)
4. Click **Analyze Alert**

## Understanding Your Results

Once analysis completes (usually 20-60 seconds), you'll see:

- **Severity Banner** — overall risk level (Critical/High/Medium/Low/Informational) with a plain-English explanation
- **MITRE ATT&CK Mapping** — which attacker techniques were observed, with confidence scores and evidence
- **Investigation Hypotheses** — 3 ranked explanations of what likely happened, including a false-positive scenario
- **Extracted IOCs & Entities** — every IP, domain, hash, user, and process identified
- **Risk Assessment** — likelihood, impact, and business risk narrative
- **Recommended Actions** — prioritized checklist (containment, eradication, recovery, hardening)
- **Full Incident Report** — complete markdown report ready to share or export

## Exporting

- **Markdown** — click "Markdown" to download a `.md` file
- **PDF** — click "Export PDF" to generate a formatted, print-ready PDF report

## Tips

- The more complete your alert (full JSON export vs. truncated text), the better the analysis
- If a hypothesis confidence seems off, check the "contradicting evidence" listed — the AI shows its work
- Use the investigation checklist as a starting point, not a replacement for analyst judgment
