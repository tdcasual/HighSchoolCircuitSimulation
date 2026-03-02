#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[legacy-prune-readiness] ${message}`);
    process.exit(1);
}

function readText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        fail(`missing file: ${relPath}`);
    }
    return readFileSync(absPath, 'utf8');
}

function assertMatch(text, regex, message) {
    if (!regex.test(text)) {
        fail(message);
    }
}

const checklistPath = 'docs/plans/2026-03-02-legacy-removal-checklist.md';
const batchBAuditPath = 'docs/plans/2026-03-02-batch-b-mode-fallback-audit.md';

const checklist = readText(checklistPath);
const batchBAudit = readText(batchBAuditPath);

assertMatch(
    checklist,
    /Batch A：已完成第 1 轮（commit:\s*`[0-9a-f]{7,40}`[^）]*）/,
    'must include batch-a commit evidence for round 1'
);
assertMatch(
    checklist,
    /Batch A：已完成第 2 轮（commit:\s*`[0-9a-f]{7,40}`[^）]*）/,
    'must include batch-a commit evidence for round 2'
);
assertMatch(
    checklist,
    /Batch B：已完成第 1 轮（commit:\s*`[0-9a-f]{7,40}`[^）]*）/,
    'must include batch-b commit evidence'
);
assertMatch(
    checklist,
    /Week 7：已完成（Task17\/18：测试契约迁移 \+ UIStateController legacy fallback 删除）。/,
    'must mark week7 as completed in checklist'
);
assertMatch(
    checklist,
    /docs\/plans\/2026-03-02-batch-b-mode-fallback-audit\.md/,
    'must link batch-b audit evidence'
);

assertMatch(
    batchBAudit,
    /结论（预审计初版）：当前不可删/,
    'must preserve batch-b pre-audit baseline conclusion'
);
assertMatch(
    batchBAudit,
    /Batch B 当前状态：已删除（Removed）。/,
    'must mark batch-b as removed in audit execution update'
);

console.log('[legacy-prune-readiness] ok');
