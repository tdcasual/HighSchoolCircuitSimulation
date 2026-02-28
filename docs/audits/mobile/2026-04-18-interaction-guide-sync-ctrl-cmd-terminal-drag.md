# Interaction Guide Sync Audit - Ctrl/Cmd Terminal Drag (2026-04-18)

## Scope

Align component lead extension interaction with documented classroom guidance and harden guide-sync checks so behavior changes cannot drift from docs.

## Changes

1. Interaction behavior update:
   - `InteractionOrchestrator` terminal extension gesture changed from `Alt + 拖动端子` to `Ctrl/Cmd + 拖动端子`.
2. Documentation sync:
   - Updated interaction usage guide baseline row to `Ctrl/Cmd + 拖动端子`.
   - Updated long-term roadmap interaction example to match current behavior.
3. Sync gate hardening:
   - `scripts/ci/assert-interaction-guide-sync.mjs` now infers required guide items from `InteractionOrchestrator` source behavior.
   - Guard no longer depends on test-description text fragments.
4. Regression updates:
   - Updated orchestrator and guide-sync tests for the new modifier key behavior.

## Validation

Executed:

```bash
npm test -- tests/interaction.orchestrator.spec.js tests/interaction.wireSegmentSnap.spec.js tests/interaction.guideSync.spec.js
node scripts/ci/assert-interaction-guide-sync.mjs
npm run check
```

Result:

- Targeted interaction tests passed.
- Interaction guide sync script passed.
- Full `check` gate passed.
- Existing non-blocking lint warning remains unchanged at `src/ui/ai/PanelLayoutController.js:125`.
