import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ComponentDefaults } from '../src/components/Component.js';

function getOverviewTableTypes(markdown) {
    const start = markdown.indexOf('## 代理概览');
    const end = markdown.indexOf('## 详细代理档案');
    const section = start >= 0 && end > start ? markdown.slice(start, end) : markdown;
    const matches = [...section.matchAll(/^\|\s*([A-Za-z][A-Za-z0-9]*)\s*\|/gm)];
    return new Set(matches.map((m) => m[1]).filter((type) => type !== '类型'));
}

describe('AGENTS doc consistency', () => {
    it('covers all component types from ComponentDefaults in overview table', () => {
        const content = readFileSync(resolve(process.cwd(), 'AGENTS.md'), 'utf8');
        const tableTypes = getOverviewTableTypes(content);
        const expectedTypes = Object.keys(ComponentDefaults);

        for (const type of expectedTypes) {
            expect(tableTypes.has(type)).toBe(true);
        }
    });

    it('does not contain template residue markers', () => {
        const content = readFileSync(resolve(process.cwd(), 'AGENTS.md'), 'utf8');
        expect(content).not.toContain('<content>');
        expect(content).not.toContain('<parameter');
    });
});
