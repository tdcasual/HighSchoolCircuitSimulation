import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('component tray contract', () => {
    it('adds a classroom-common region ahead of the full component catalog', () => {
        const html = readFileSync('index.html', 'utf8');

        expect(html).toContain('class="toolbox-lead"');
        expect(html).toContain('data-category="classroom-common"');
        expect(html).toContain('data-collapsible="false"');
        expect(html).toContain('课堂常用');
    });
});
