#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[interaction-guide-sync] ${message}`);
    process.exit(1);
}

function readText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        fail(`missing file: ${relPath}`);
    }
    return readFileSync(absPath, 'utf8');
}

function readOptionalText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        return '';
    }
    return readFileSync(absPath, 'utf8');
}

function readOptionalTextsFromInteractionDir(fileNamePattern) {
    const interactionDirRel = 'src/app/interaction';
    const interactionDirAbs = path.resolve(root, interactionDirRel);
    if (!existsSync(interactionDirAbs)) {
        return [];
    }
    const names = readdirSync(interactionDirAbs);
    return names
        .filter((name) => fileNamePattern.test(name))
        .sort()
        .map((name) => {
            const relPath = path.posix.join(interactionDirRel, name);
            return readOptionalText(relPath);
        });
}

const guidePath = 'docs/process/component-interaction-usage-guide.md';
const guide = readText(guidePath);
const interactionSourceParts = [
    readText('src/app/interaction/InteractionOrchestrator.js'),
    ...readOptionalTextsFromInteractionDir(/^InteractionOrchestratorMouseDown.*Handlers\.js$/)
];
const interactionSource = interactionSourceParts.join('\n');

function hasCtrlCmdModifier(source) {
    return /e\.ctrlKey\s*\|\|\s*e\.metaKey|e\.metaKey\s*\|\|\s*e\.ctrlKey/.test(source);
}

function inferTerminalExtendGuideItem(source) {
    const marker = 'this.startTerminalExtend(componentId, terminalIndex, e)';
    const markerIdx = source.indexOf(marker);
    if (markerIdx < 0) {
        fail('unable to locate terminal extension behavior in interaction sources');
    }

    const windowStart = Math.max(0, markerIdx - 300);
    const snippet = source.slice(windowStart, markerIdx + marker.length);
    if (hasCtrlCmdModifier(snippet)) return 'Ctrl/Cmd + 拖动端子';
    if (/e\.altKey/.test(snippet)) return 'Alt + 拖动端子';
    fail('unable to infer terminal extension key modifier from orchestrator');
}

function inferWireSplitGuideItem(source) {
    const marker = 'this.splitWireAtPoint(';
    const markerIdx = source.indexOf(marker);
    if (markerIdx < 0) {
        fail('unable to locate wire split behavior in interaction sources');
    }

    const windowStart = Math.max(0, markerIdx - 400);
    const snippet = source.slice(windowStart, markerIdx + marker.length);
    if (hasCtrlCmdModifier(snippet)) return 'Ctrl/Cmd + 点击导线';
    fail('unable to infer wire split key modifier from orchestrator');
}

const requiredGuideItems = [
    inferTerminalExtendGuideItem(interactionSource),
    inferWireSplitGuideItem(interactionSource)
];

for (const item of requiredGuideItems) {
    if (!guide.includes(item)) {
        fail(`${guidePath} missing item: ${item}`);
    }
}

console.log('[interaction-guide-sync] ok');
