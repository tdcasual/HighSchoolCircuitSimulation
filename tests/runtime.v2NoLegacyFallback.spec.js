import { describe, expect, it, vi } from 'vitest';
import {
    readInteractionModeContextV2,
    setInteractionModeContextV2
} from '../src/app/interaction/InteractionModeBridge.js';
import { normalizeObservationTemplateV2 } from '../src/ui/observation/ObservationState.js';
import { EmbedRuntimeBridge } from '../src/embed/EmbedRuntimeBridge.js';

describe('v2 runtime no-legacy-fallback contract', () => {
    it('rejects missing mode store context instead of reading legacy runtime fields', () => {
        const context = {
            pendingToolType: 'Wire',
            pendingTool: 'Wire'
        };
        expect(() => readInteractionModeContextV2(context)).toThrow(/requires interaction mode store context/u);
    });

    it('rejects pendingToolType alias in v2 mode context updates', () => {
        const context = {
            syncInteractionModeStore: vi.fn(() => ({ mode: 'select', context: {}, version: 1 }))
        };
        expect(() => setInteractionModeContextV2(context, { pendingToolType: 'Wire' }))
            .toThrow(/legacy mode alias/u);
    });

    it('rejects legacy observation template aliases in v2 normalization', () => {
        expect(() => normalizeObservationTemplateV2({
            name: '模板A',
            templateName: 'legacy-alias',
            plots: [],
            bindings: []
        })).toThrow(/legacy alias/u);

        expect(() => normalizeObservationTemplateV2({
            name: '模板B',
            plots: [],
            bindings: [],
            bindingMap: []
        })).toThrow(/legacy alias/u);
    });

    it('enforces strict mode validation for embed setOptions in v2 runtime', () => {
        const bridge = new EmbedRuntimeBridge(
            {
                logger: { child: () => null },
                setClassroomModeLevel: vi.fn()
            },
            { enabled: false },
            {}
        );

        expect(() => bridge.handleSetOptions({
            runtimeVersion: 2,
            mode: 'legacy-mode'
        })).toThrow(/Unsupported embed mode/u);
    });
});
