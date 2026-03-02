import { afterEach, describe, expect, it, vi } from 'vitest';
import { installInteractionCoreInputPlacementDelegates } from '../src/ui/interaction/InteractionCoreInputPlacementDelegates.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function createContext(overrides = {}) {
    return {
        app: {
            classroomMode: { activeLevel: 'off' },
            embedRuntimeBridge: { enabled: false }
        },
        pendingToolType: null,
        mobileInteractionMode: 'select',
        stickyWireTool: false,
        endpointAutoBridgeMode: 'auto',
        isWiring: false,
        isDraggingWireEndpoint: false,
        isTerminalExtending: false,
        isRheostatDragging: false,
        ...overrides
    };
}

describe('Interaction mode matrix diagnostics', () => {
    it('installs getInteractionModeSnapshot delegate on interaction manager', () => {
        class FakeInteractionManager {}
        installInteractionCoreInputPlacementDelegates(FakeInteractionManager);

        expect(typeof FakeInteractionManager.prototype.getInteractionModeSnapshot).toBe('function');
    });

    it('reports mode conflict when wire mode and endpoint edit are both active', () => {
        class FakeInteractionManager {}
        installInteractionCoreInputPlacementDelegates(FakeInteractionManager);
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false)
                }
            }
        });

        const context = createContext({
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            isWiring: true,
            isDraggingWireEndpoint: true
        });
        const snapshot = FakeInteractionManager.prototype.getInteractionModeSnapshot.call(context);

        expect(snapshot.mode).toBe('conflict');
        expect(snapshot.hasConflict).toBe(true);
        expect(snapshot.activeModes).toEqual(['wire', 'endpoint-edit']);
    });

    it('captures phone/classroom/embed runtime matrix in wire mode snapshot', () => {
        class FakeInteractionManager {}
        installInteractionCoreInputPlacementDelegates(FakeInteractionManager);
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn((name) => name === 'layout-mode-phone')
                }
            }
        });

        const context = createContext({
            app: {
                classroomMode: { activeLevel: 'standard' },
                embedRuntimeBridge: { enabled: true }
            },
            pendingToolType: 'Wire',
            mobileInteractionMode: 'wire',
            stickyWireTool: true,
            endpointAutoBridgeMode: 'on'
        });
        const snapshot = FakeInteractionManager.prototype.getInteractionModeSnapshot.call(context);

        expect(snapshot.mode).toBe('wire');
        expect(snapshot.hasConflict).toBe(false);
        expect(snapshot.runtime).toEqual({
            phoneLikeLayout: true,
            classroomModeActive: true,
            embedRuntimeActive: true
        });
        expect(snapshot.mobile).toEqual({
            interactionMode: 'wire',
            stickyWireTool: true,
            endpointAutoBridgeMode: 'on'
        });
    });

    it('prefers interaction mode-store context when runtime flags lag behind', () => {
        class FakeInteractionManager {}
        installInteractionCoreInputPlacementDelegates(FakeInteractionManager);
        vi.stubGlobal('document', {
            body: {
                classList: {
                    contains: vi.fn(() => false)
                }
            }
        });

        const context = createContext({
            pendingToolType: null,
            mobileInteractionMode: 'select',
            stickyWireTool: false,
            isWiring: false,
            interactionModeStore: {
                getState: () => ({
                    mode: 'wire',
                    context: {
                        pendingToolType: 'Wire',
                        mobileInteractionMode: 'wire',
                        stickyWireTool: true,
                        isWiring: true,
                        isDraggingWireEndpoint: false,
                        isTerminalExtending: false,
                        isRheostatDragging: false
                    }
                })
            }
        });

        const snapshot = FakeInteractionManager.prototype.getInteractionModeSnapshot.call(context);
        expect(snapshot.mode).toBe('wire');
        expect(snapshot.pendingToolType).toBe('Wire');
        expect(snapshot.wireSignals).toEqual({
            pendingWireTool: true,
            wireModeSelected: true,
            stickyWireTool: true,
            activeWiringSession: true
        });
    });
});
