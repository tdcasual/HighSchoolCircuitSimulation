import { describe, expect, it, vi } from 'vitest';
import { handlePendingToolMouseDown } from '../src/app/interaction/InteractionOrchestratorMouseDownHandlers.js';

describe('InteractionOrchestratorMouseDownHandlers.handlePendingToolMouseDown', () => {
    it('returns false when no pending tool is armed', () => {
        const context = {
            pendingToolType: null,
            placePendingToolAt: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 12,
            clientY: 16,
            target: {}
        };

        const handled = handlePendingToolMouseDown.call(context, event, {
            target: event.target,
            terminalTarget: null,
            componentGroup: null
        });

        expect(handled).toBe(false);
        expect(context.placePendingToolAt).not.toHaveBeenCalled();
    });

    it('starts wiring from terminal point when wire tool is armed', () => {
        const terminalTarget = { dataset: { terminal: '1' } };
        const componentGroup = { dataset: { id: 'R1' } };
        const context = {
            pendingToolType: 'Wire',
            isWiring: false,
            resolvePointerType: vi.fn(() => 'mouse'),
            renderer: {
                getTerminalPosition: vi.fn(() => ({ x: 220, y: 180 }))
            },
            circuit: {
                getComponent: vi.fn(() => ({ type: 'Resistor' }))
            },
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 10, y: 12 })),
            startWiringFromPoint: vi.fn(),
            updateStatus: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 120,
            clientY: 90,
            target: {
                dataset: {},
                classList: { contains: vi.fn(() => false) },
                closest: vi.fn(() => null)
            }
        };

        const handled = handlePendingToolMouseDown.call(context, event, {
            target: event.target,
            terminalTarget,
            componentGroup
        });

        expect(handled).toBe(true);
        expect(context.startWiringFromPoint).toHaveBeenCalledWith({ x: 220, y: 180 }, event, true);
        expect(context.updateStatus).toHaveBeenCalledWith('导线模式：选择终点');
    });

    it('cancels active wiring when no valid finish snap is found', () => {
        const context = {
            pendingToolType: 'Wire',
            stickyWireTool: false,
            isWiring: true,
            resolvePointerType: vi.fn(() => 'mouse'),
            isWireEndpointTarget: vi.fn(() => false),
            screenToCanvas: vi.fn(() => ({ x: 300, y: 200 })),
            snapPoint: vi.fn(() => ({ x: 300, y: 200, snap: { type: 'grid' } })),
            finishWiringToPoint: vi.fn(),
            cancelWiring: vi.fn(),
            clearPendingToolType: vi.fn(),
            updateStatus: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 300,
            clientY: 200,
            target: {
                dataset: {},
                classList: { contains: vi.fn(() => false) },
                closest: vi.fn(() => null)
            }
        };

        const handled = handlePendingToolMouseDown.call(context, event, {
            target: event.target,
            terminalTarget: null,
            componentGroup: null
        });

        expect(handled).toBe(true);
        expect(context.finishWiringToPoint).not.toHaveBeenCalled();
        expect(context.cancelWiring).toHaveBeenCalledTimes(1);
        expect(context.clearPendingToolType).toHaveBeenCalledWith({ silent: true });
    });

    it('places pending non-wire tool and exits', () => {
        const context = {
            pendingToolType: 'Resistor',
            placePendingToolAt: vi.fn()
        };
        const event = {
            button: 0,
            clientX: 44,
            clientY: 55,
            target: {}
        };

        const handled = handlePendingToolMouseDown.call(context, event, {
            target: event.target,
            terminalTarget: null,
            componentGroup: null
        });

        expect(handled).toBe(true);
        expect(context.placePendingToolAt).toHaveBeenCalledWith(44, 55);
    });
});
