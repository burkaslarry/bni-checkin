# Security audit logs (SRAA)

Implementation notes for the Aug–Sep 2026 access-control / crypto / perimeter pass: [quick-wins-2026-08.md](./quick-wins-2026-08.md).

Production Vercel deploys run `scripts/deploy-vercel-production.sh`, which writes npm audit output here for **Security Risk Assessment and Audit** traceability.

Each file is named `npm-audit-YYYYMMDD-HHMMSS.txt`.

Do not commit secrets. These logs contain dependency vulnerability scan results only.
