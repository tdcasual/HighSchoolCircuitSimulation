import { describe, expect, it, vi } from 'vitest';
import { EmbedRuntimeBridge } from '../src/embed/EmbedRuntimeBridge.js';

function createFixture() {
    const body = {
        classList: {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn()
        }
    };
    const doc = {
        body,
        querySelector: vi.fn(() => null),
        getElementById: vi.fn(() => null)
    };
    const win = {
        parent: { postMessage: vi.fn() },
        setTimeout,
        clearTimeout,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    };
    const app = {
        circuit: {
            isRunning: false,
            components: new Map(),
            wires: new Map()
        },
        classroomMode: {
            activeLevel: 'off'
        },
        logger: {
            child: vi.fn(() => ({
                error: vi.fn()
            }))
        },
        startSimulation: vi.fn(),
        clearCircuit: vi.fn(),
        loadCircuitData: vi.fn()
    };

    return {
        app,
        doc,
        win
    };
}

describe('EmbedRuntimeBridge readonly mutation guard', () => {
    it('blocks run clearCircuit and loadCircuit in readonly mode with stable error code', () => {
        const fixture = createFixture();
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            { enabled: true, mode: 'readonly' },
            { window: fixture.win, document: fixture.doc }
        );

        expect(() => bridge.handleRequest('run')).toThrowError(/readonly/i);
        expect(() => bridge.handleRequest('clearCircuit')).toThrowError(/readonly/i);
        expect(() => bridge.handleRequest('loadCircuit', {
            circuit: { components: [], wires: [] }
        })).toThrowError(/readonly/i);

        for (const method of ['run', 'clearCircuit']) {
            try {
                bridge.handleRequest(method);
            } catch (error) {
                expect(error.code).toBe('READONLY_MUTATION_BLOCKED');
                expect(error.details).toMatchObject({ method, readOnly: true });
            }
        }

        try {
            bridge.handleRequest('loadCircuit', {
                circuit: { components: [], wires: [] }
            });
        } catch (error) {
            expect(error.code).toBe('READONLY_MUTATION_BLOCKED');
            expect(error.details).toMatchObject({ method: 'loadCircuit', readOnly: true });
        }

        expect(fixture.app.startSimulation).not.toHaveBeenCalled();
        expect(fixture.app.clearCircuit).not.toHaveBeenCalled();
        expect(fixture.app.loadCircuitData).not.toHaveBeenCalled();
    });
});
