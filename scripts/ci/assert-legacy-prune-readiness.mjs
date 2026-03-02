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
    /Batch B：预审计已完成，结论为“暂缓删除（阻塞中）”。/,
    'must keep batch-b blocked status'
);
assertMatch(
    checklist,
    /当前不满足删除前置条件/,
    'must document why batch-b is blocked'
);
assertMatch(
    checklist,
    /docs\/plans\/2026-03-02-batch-b-mode-fallback-audit\.md/,
    'must link batch-b audit evidence in checklist'
);

assertMatch(
    batchBAudit,
    /结论：当前不可删/,
    'must keep batch-b audit non-removable conclusion'
);
assertMatch(
    batchBAudit,
    /Batch B 当前状态：阻塞（Not Removable Yet）。/,
    'must keep batch-b audit blocking decision'
);

console.log('[legacy-prune-readiness] ok');
