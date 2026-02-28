# Day 26 Classroom Audit - Docs, Changelog, QA Signoff

Date: 2026-03-27
Scope: Week 4 Day 26 (release docs + QA handoff)

## Goal

Prepare release documentation and QA signoff artifacts for v0.9 release candidate.

## Deliverables

1. README release notes and migration notes
- `README.md`
- Added sections:
  - `v0.9 RC 更新（2026-03）`
  - `迁移说明（v0.9 RC）`
- Added links to release notes and QA checklist.

2. Release notes + known issues
- `docs/releases/v0.9-rc1-release-notes.md`
- Includes:
  - highlights,
  - changelog by area,
  - migration notes,
  - known issues table,
  - verification snapshot.

3. QA checklist and signoff
- `docs/releases/v0.9-qa-checklist.md`
- Includes gate command matrix, critical-area evidence, and Go/No-Go conclusion.

## Verification Evidence

1. `npm run check:full`
- Result: pass
- Includes `check`, `baseline:p0`, `baseline:circuitjs`, `baseline:ai`.

## Outcome

- Release documentation baseline is complete for v0.9 RC review.
- QA signoff artifact is in place with explicit gate evidence and known-issues traceability.
