import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('chart window design contract', () => {
    it('defines experiment record header and channel section styles', () => {
        const css = readFileSync('css/style.css', 'utf8');
        expect(css).toContain('.chart-window-record-header');
        expect(css).toContain('.chart-window-readout');
        expect(css).toContain('.chart-window-channel-list');
    });
});
