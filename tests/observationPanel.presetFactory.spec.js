import { describe, expect, it } from 'vitest';
import { buildObservationPresetHint, buildObservationPresetStatusText, createObservationPreset } from '../src/ui/ObservationPanel.js';

describe('Observation preset factory', () => {
    it('creates current-time preset for wire current probe source', () => {
        const preset = createObservationPreset({
            sourceId: '__probe__:P2',
            probeType: 'WireCurrentProbe',
            preferred: 'time'
        });

        expect(preset.x.sourceId).toBe('__time__');
        expect(preset.x.quantityId).toBe('t');
        expect(preset.y.sourceId).toBe('__probe__:P2');
        expect(preset.y.quantityId).toBe('I');
    });

    it('builds semantic hint text for current-time preset', () => {
        const hint = buildObservationPresetHint('current-time', {
            sourceId: '__probe__:P2',
            probeType: 'WireCurrentProbe'
        });

        expect(hint).toContain('电流-时间');
        expect(hint).toContain('P2');
    });

    it('builds status text after applying preset', () => {
        const statusText = buildObservationPresetStatusText('power-time', {
            sourceId: 'R1',
            sourceLabel: 'R1'
        });

        expect(statusText).toContain('已添加');
        expect(statusText).toContain('功率-时间');
        expect(statusText).toContain('R1');
    });
});
