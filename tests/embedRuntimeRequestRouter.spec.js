import { describe, expect, it, vi } from 'vitest';

function createBridgeStub(overrides = {}) {
    const bridge = {
        mode: 'edit',
        readOnly: false,
        featureFlags: {
            toolbox: true,
            sidePanel: true,
            statusBar: true,
            ai: true,
            exerciseBoard: true
        },
        app: {
            startSimulation: vi.fn(),
            stopSimulation: vi.fn(),
            clearCircuit: vi.fn(),
            loadCircuitData: vi.fn(() => ({ componentCount: 1, wireCount: 0 })),
            buildSaveData: vi.fn(() => ({ components: [], wires: [] }))
        },
        isReadOnlyActive() {
            return this.mode === 'readonly' || this.readOnly;
        },
        applyMode: vi.fn(),
        applyFeatures: vi.fn(function applyFeatures(nextFlags) {
            bridge.featureFlags = { ...nextFlags };
        }),
        applyClassroomLevel: vi.fn(),
        getStateSnapshot: vi.fn(() => ({
            mode: bridge.mode,
            readOnly: bridge.mode === 'readonly' || bridge.readOnly,
            featureFlags: { ...bridge.featureFlags }
        }))
    };

    return Object.assign(bridge, overrides);
}

describe('Embed runtime request router seam', () => {
    it('blocks readonly mutations with stable bridge error metadata', async () => {
        const { handleEmbedRuntimeRequest } = await import('../src/embed/EmbedRuntimeRequestRouter.js');
        const bridge = createBridgeStub({ mode: 'readonly' });

        expect(() => handleEmbedRuntimeRequest(bridge, 'run')).toThrowError(/readonly/i);

        try {
            handleEmbedRuntimeRequest(bridge, 'clearCircuit');
        } catch (error) {
            expect(error.code).toBe('READONLY_MUTATION_BLOCKED');
            expect(error.details).toMatchObject({ method: 'clearCircuit', readOnly: true });
        }
    });

    it('applies strict v2 setOptions through the router seam', async () => {
        const { handleEmbedSetOptions } = await import('../src/embed/EmbedRuntimeRequestRouter.js');
        const bridge = createBridgeStub();

        const state = handleEmbedSetOptions(bridge, {
            runtimeVersion: 2,
            mode: 'readonly',
            readOnly: true,
            features: {
                toolbox: false,
                ai: false
            }
        });

        expect(bridge.mode).toBe('readonly');
        expect(bridge.readOnly).toBe(true);
        expect(bridge.applyMode).toHaveBeenCalled();
        expect(bridge.applyFeatures).toHaveBeenCalled();
        expect(state.readOnly).toBe(true);
    });

    it('validates loadCircuit payloads before dispatch', async () => {
        const { handleEmbedRuntimeRequest } = await import('../src/embed/EmbedRuntimeRequestRouter.js');
        const bridge = createBridgeStub();

        expect(() => handleEmbedRuntimeRequest(bridge, 'loadCircuit', {})).toThrow(/payload\.circuit is required/i);
        expect(bridge.app.loadCircuitData).not.toHaveBeenCalled();
    });
});
