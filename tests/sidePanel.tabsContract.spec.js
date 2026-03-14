import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('side panel tab contract', () => {
    it('restores properties, observation, and guide tabs', () => {
        const html = readFileSync('index.html', 'utf8');

        expect(html).toContain('class="side-panel-tabs"');
        expect(html).toContain('data-panel="properties"');
        expect(html).toContain('data-panel="observation"');
        expect(html).toContain('data-panel="guide"');
        expect(html).toContain('id="panel-observation"');
        expect(html).toContain('id="panel-guide"');
        expect(html).toContain('id="observation-root"');
    });
});
