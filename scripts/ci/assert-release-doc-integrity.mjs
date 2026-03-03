#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[docs-integrity] ${message}`);
    process.exit(1);
}

function readText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        fail(`missing file: ${relPath}`);
    }
    return readFileSync(absPath, 'utf8');
}

function readJson(relPath) {
    const content = readText(relPath);
    try {
        return JSON.parse(content);
    } catch (error) {
        fail(`${relPath} is not valid JSON: ${error.message}`);
    }
}

const manifestPath = 'docs/releases/release-evidence-index.json';
const manifest = readJson(manifestPath);
const reviewPath = manifest.reviewPath || 'docs/audits/mobile/2026-03-29-day28-release-readiness-review.md';
const review = readText(reviewPath);

if (!Array.isArray(manifest.requiredDocs) || manifest.requiredDocs.length === 0) {
    fail(`${manifestPath} must define non-empty requiredDocs array`);
}

if (!Array.isArray(manifest.requiredOutputs) || manifest.requiredOutputs.length === 0) {
    fail(`${manifestPath} must define non-empty requiredOutputs array`);
}

for (const relPath of manifest.requiredDocs) {
    if (!review.includes(relPath)) {
        fail(`${reviewPath} missing reference: ${relPath}`);
    }
    if (!existsSync(path.resolve(root, relPath))) {
        fail(`referenced doc does not exist: ${relPath}`);
    }
}

for (const relPath of manifest.requiredOutputs) {
    if (!review.includes(relPath)) {
        fail(`${reviewPath} missing output reference: ${relPath}`);
    }
}

console.log('[docs-integrity] ok');
