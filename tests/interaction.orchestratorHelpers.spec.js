import { describe, expect, it, vi } from 'vitest';
import { resolveLiveWireStart } from '../src/app/interaction/InteractionOrchestratorHelpers.js';

describe('InteractionOrchestratorHelpers.resolveLiveWireStart', () => {
    it('accepts numeric terminal component ids by normalizing them to strings', () => {
        const snap = { type: 'terminal', componentId: 0, terminalIndex: 1 };
        const context = {
            wireStart: { snap },
            renderer: {
                getTerminalPosition: vi.fn((componentId, terminalIndex) => (
                    componentId === '0' && terminalIndex === 1 ? { x: 12, y: 34 } : null
                ))
            }
        };

        const start = resolveLiveWireStart(context);

        expect(start).toEqual({ x: 12, y: 34, snap });
    });

    it('accepts numeric wire endpoint ids by normalizing them to strings', () => {
        const snap = { type: 'wire-endpoint', wireId: 0, end: 'a' };
        const context = {
            wireStart: { snap },
            circuit: {
                getWire: vi.fn((wireId) => (
                    wireId === '0'
                        ? { id: '0', a: { x: 3, y: 4 }, b: { x: 8, y: 9 } }
                        : null
                ))
            }
        };

        const start = resolveLiveWireStart(context);

        expect(start).toEqual({ x: 3, y: 4, snap });
    });
});
