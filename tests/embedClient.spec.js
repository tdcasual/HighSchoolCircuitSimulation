import { describe, expect, it } from 'vitest';
import { buildEmbedUrl } from '../src/embed/EmbedClient.js';

describe('buildEmbedUrl', () => {
    it('builds embed url with mode/features/runtime flags', () => {
        const href = buildEmbedUrl({
            src: 'embed.html',
            mode: 'classroom',
            classroomLevel: 'enhanced',
            readOnly: false,
            autoSave: true,
            restoreFromStorage: false,
            targetOrigin: 'https://lms.example',
            features: {
                toolbox: false,
                ai: true
            }
        }, 'https://sim.example/app/');

        const url = new URL(href);
        expect(url.origin).toBe('https://sim.example');
        expect(url.pathname).toBe('/app/embed.html');
        expect(url.searchParams.get('embed')).toBe('1');
        expect(url.searchParams.get('mode')).toBe('classroom');
        expect(url.searchParams.get('classroomLevel')).toBe('enhanced');
        expect(url.searchParams.get('autosave')).toBe('1');
        expect(url.searchParams.get('restore')).toBe('0');
        expect(url.searchParams.get('targetOrigin')).toBe('https://lms.example');
        expect(url.searchParams.get('toolbox')).toBe('0');
        expect(url.searchParams.get('ai')).toBe('1');
    });
});
