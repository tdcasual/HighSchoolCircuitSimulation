import { describe, expect, it } from 'vitest';
import { createObservationPreset } from '../src/ui/ObservationPanel.js';

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
});
