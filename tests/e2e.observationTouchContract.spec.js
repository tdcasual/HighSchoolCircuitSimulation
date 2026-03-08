import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('observation touch e2e contract', () => {
    it('uses chartWorkspace runtime contract instead of legacy observationPanel globals', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/e2e/observation-touch-regression.mjs');
        const source = readFileSync(scriptPath, 'utf8');

        expect(source).toContain('window.app?.chartWorkspace');
        expect(source).not.toContain('window.app?.observationPanel');
        expect(source).not.toContain('window.app.observationPanel');
    });

    it('does not use observationPanel runtime fallback in responsive touch regression', () => {
        const scriptPath = resolve(process.cwd(), 'scripts/e2e/responsive-touch-regression.mjs');
        const source = readFileSync(scriptPath, 'utf8');

        expect(source).toContain('app.chartWorkspace?.windows');
        expect(source).not.toContain('app.observationPanel?.plots');
        expect(source).not.toContain('app.observationPanel.plots');
    });

    it('binds pointercancel to chart interaction so touch interruptions do not leave stale readout state', () => {
        const sourcePath = resolve(process.cwd(), 'src/ui/observation/ObservationInteractionController.js');
        const source = readFileSync(sourcePath, 'utf8');

        expect(source).toContain('pointercancel');
        expect(source).toContain('onPointerCancel');
        expect(source).toContain('onPointerUp(point)');
    });
});