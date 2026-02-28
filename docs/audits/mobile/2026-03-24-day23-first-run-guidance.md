# Day 23 Classroom Audit - First-Run Guidance

Date: 2026-03-24
Scope: Week 4 Day 23 (lightweight first-run guide overlay)

## Goal

Provide a lightweight first-run guide with skip/remember behavior, without disturbing returning users.

## Implementation Summary

1. Added first-run guide controller
- `src/ui/FirstRunGuideController.js`
- Features:
  - auto show only when not previously dismissed,
  - `稍后` and `开始使用` actions,
  - optional `不再提示` persistence.

2. Integrated at app startup
- `src/main.js`
- Initializes guide controller after core UI setup.
- Disabled by default in embed runtime (`enabled: !runtimeOptions.enabled`).

3. Added persisted guide preference helpers
- `src/ui/interaction/UIStateController.js`
- Added:
  - `FIRST_RUN_GUIDE_DISMISSED_STORAGE_KEY`
  - `isFirstRunGuideDismissed(...)`
  - `setFirstRunGuideDismissed(...)`
  - `shouldShowFirstRunGuide(...)`

4. Added guide overlay styles
- `css/style.css`
- Added desktop/mobile-friendly overlay card and action layout styles.

5. Added tests for skip/remember state logic
- `tests/interaction.uiStateController.spec.js`
- Covers:
  - default show behavior,
  - persistence when dismissed,
  - feature disabled path,
  - storage failure fallback.

## Verification Evidence

1. `npm test -- tests/interaction.uiStateController.spec.js`
- Result: pass
- Test files: 1 passed
- Tests: 9 passed

## Outcome

- New users get a concise onboarding hint.
- Returning users can suppress repeat prompts via remember option.
