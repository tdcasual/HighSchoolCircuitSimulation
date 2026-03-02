# Architecture De-risk (Week 5-10) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不牺牲稳定性的前提下，把 Week 1-4 形成的“双轨兼容状态”收敛为单轨实现，完成大规模旧路径删除前的证据闭环与回滚保障。

**Architecture:** 先做“观测-约束-迁移-删除”四段式推进。Week 5-6 建立 legacy 路径使用证据与初始化强约束；Week 7-8 在测试契约迁移后删除关键 fallback；Week 9-10 完成高风险兼容分支收尾，并以批次可回滚方式执行大规模删除。

**Tech Stack:** Vanilla JS (ESM), Vitest, Node CI scripts, existing E2E matrix gates.

---

## Week 5 - Legacy Usage Observability Baseline

### Task 13: Legacy path usage tracker + critical path probes

**Files:**
- Create: `src/app/legacy/LegacyPathUsageTracker.js`
- Modify: `src/ui/interaction/UIStateController.js`
- Modify: `src/ui/ClassroomModeController.js`
- Create: `tests/legacyPathUsageTracker.spec.js`
- Modify: `tests/interaction.uiStateController.spec.js`
- Modify: `tests/classroomModeController.spec.js`

**Step 1: Write failing tests**
- tracker basic contract fail-first.
- mode fallback path emits usage count.
- classroom legacy bool read emits usage count.

**Step 2: Run to verify fail**
Run:
`npm test -- tests/legacyPathUsageTracker.spec.js tests/interaction.uiStateController.spec.js tests/classroomModeController.spec.js`
Expected: FAIL (tracker missing / no probe event).

**Step 3: Minimal implementation**
- implement tracker API (`record/getSnapshot/clear`).
- instrument only two highest-value legacy read paths.

**Step 4: Verify targeted tests**
Run same command as Step 2.
Expected: PASS.

**Step 5: Commit**
`git commit -m "feat(legacy): add usage tracker and instrument critical fallback paths"`

### Task 14: Add deletion readiness evidence script

**Files:**
- Create: `scripts/ci/assert-legacy-prune-readiness.mjs`
- Create: `tests/legacyPruneReadiness.spec.js`
- Modify: `package.json`

**Step 1: Write failing guard test**
- require script to assert:
  - Batch B remains blocked without store-init guarantees.
  - Batch A completed items have commit evidence in checklist.

**Step 2: Run fail-first**
`npm test -- tests/legacyPruneReadiness.spec.js`
Expected: FAIL until script exists.

**Step 3: Minimal implementation**
- parse `docs/plans/2026-03-02-legacy-removal-checklist.md`.
- fail when status/required evidence missing.

**Step 4: Verify**
`npm test -- tests/legacyPruneReadiness.spec.js`
Expected: PASS.

**Step 5: Commit**
`git commit -m "test(ci): add legacy prune readiness guard"`

## Week 6 - Initialization and Mode-store Hard Guarantees

### Task 15: Ensure interactionModeStore exists at InteractionManager init

**Files:**
- Modify: `src/ui/Interaction.js`
- Modify: `src/app/interaction/InteractionOrchestrator.js`
- Modify: `tests/interaction.modeStore.spec.js`

### Task 16: Force mode-store sync on ToolPlacement mobile entrypoints

**Files:**
- Modify: `src/ui/interaction/ToolPlacementController.js`
- Modify: `tests/interaction.toolPlacementController.spec.js`
- Modify: `tests/interaction.modeMatrix.spec.js`

## Week 7 - Batch B Execution (remove UIStateController legacy fallback)

### Task 17: Migrate test contract from fallback-allowed to store-required

**Files:**
- Modify: `tests/interaction.uiStateController.spec.js`

### Task 18: Remove fallback code and keep explicit safe default on invalid mode

**Files:**
- Modify: `src/ui/interaction/UIStateController.js`

## Week 8 - Batch C Slice A (classroom legacy bool compatibility wind-down)

### Task 19: Stop writing legacy bool mirror key (read-only migration window)

**Files:**
- Modify: `src/ui/ClassroomModeController.js`
- Modify: `tests/classroomModeController.spec.js`

### Task 20: Add one-time migration note + release checklist entry

**Files:**
- Modify: `docs/plans/2026-03-02-legacy-removal-checklist.md`
- Modify: `docs/releases/v0.10-stability-checklist.md`

## Week 9 - Batch C Slice B (observation legacy schema compatibility pruning)

### Task 21: Inventory and classify observation legacy fields (must-have vs removable)

**Files:**
- Modify: `src/ui/observation/ObservationState.js`
- Modify: `tests/observationState.spec.js`
- Create: `docs/audits/observation-ui/2026-xx-xx-legacy-schema-prune-audit.md`

### Task 22: Remove removable compatibility branches with fixture backfill

**Files:**
- Modify: `src/ui/observation/ObservationState.js`
- Modify: `tests/observationState.spec.js`
- Modify: `tests/observationPanel.quickBind.spec.js`

## Week 10 - Batch D and Mass Deletion Window

### Task 23: Remove interaction legacy mirror writes (after zero-usage evidence)

**Files:**
- Modify: `src/app/interaction/InteractionOrchestrator.js`
- Modify: `src/ui/interaction/PointerSessionManager.js`
- Modify: related interaction tests

### Task 24: Large-scale delete execution in reversible slices

**Files:**
- Modify: `docs/plans/2026-03-02-legacy-removal-checklist.md`
- Create: `docs/reports/2026-xx-xx-legacy-prune-final-report.md`

**Execution rule:**
- at most 1 risk tier per commit.
- one commit one rollback target.

---

## Week 5-10 Acceptance Gates

Each deletion/migration slice must pass:

1. `npm run lint`
2. `npm test`
3. `npm run test:e2e:wire`
4. `npm run test:e2e:responsive`
5. `npm run mode-conflict-matrix`

And for readiness slices:

6. `npm run check:registry-guard`
7. `npm run check:ci-workflow`

## Backout Strategy

1. 每个任务单独 commit，禁止跨风险层级混改。
2. 任意门禁失败：立即 `git revert <commit>`，回到前一稳定点。
3. 大规模删除只在 Week 10 执行，前置为连续两轮全门禁绿 + readiness guard 绿。
