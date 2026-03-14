import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('workbench top bar contract', () => {
    it('contains primary, session, and secondary top bar zones', () => {
        const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

        expect(html).toContain('id="top-action-primary"');
        expect(html).toContain('id="top-action-session"');
        expect(html).toContain('id="top-action-secondary"');
        expect(html).toContain('id="experiment-title"');
        expect(html).toContain('id="experiment-session-hint"');
        expect(html).toContain('id="status-ribbon"');
        expect(html).toContain('id="status-ribbon-text"');
    });
});
