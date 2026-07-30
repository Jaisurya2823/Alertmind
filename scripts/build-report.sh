#!/bin/sh
# AlertMind — Manual Report Regeneration
# Usage: ./scripts/build-report.sh <investigationId>
set -e

INVESTIGATION_ID="$1"

if [ -z "$INVESTIGATION_ID" ]; then
  echo "Usage: $0 <investigationId>"
  echo "Example: $0 123e4567-e89b-12d3-a456-426614174000"
  exit 1
fi

echo "AlertMind — Regenerating report for investigation: $INVESTIGATION_ID"

node --env-file=.env -e "
import('./src/modules/report/report.service.js').then(async ({ generateReportPdf }) => {
  try {
    const result = await generateReportPdf('$INVESTIGATION_ID', process.env.MINIO_BUCKET);
    console.log('Report generated:', result.storageKey);
    console.log('Download URL:', result.presignedUrl);
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
});
"
