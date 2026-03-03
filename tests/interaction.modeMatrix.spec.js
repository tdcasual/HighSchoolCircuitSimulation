import { afterEach, describe, expect, it, vi } from 'vitest';
import { installInteractionCoreInputPlacementDelegates } from '../src/ui/interaction/InteractionCoreInputPlacementDelegates.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function resolveModeFromContext(context = {}) {
    if (context.isDraggingWireEndpoint || context.isTerminalExtending || context.isRheostatDragging) {
        return 'endpoint-edit';
    }
    if (
        context.pendingTool === 'Wire'
        || context.mobileMode === 'wire'
        || context.wireModeSticky
        || context.wiringActive
    ) {
        return 'wire';
    }
    return 'select';
}

function createModeStoreContextSnapshot(context = {}) {
    return {
        pendingTool: context.pendingTool ?? null,
        mobileMode: context.mobileMode === 'wire' ? 'wire' : 'select',
        wireModeSticky: !!context.wireModeSticky,
        wiringActive: !!context.wiringActive,
        isDraggingWireEndpoint: !!context.isDraggingWireEndpoint,
        isTerminalExtending: !!context.isTerminalExtending,
        isRheostatDragging: !!context.isRheostatDragging
    };
}

function createContext(overrides = {}) {
    const context = {
        app: {
            classroomMode: { activeLevel: 'off' },
            embedRuntimeBridge: { enabled: false }
        },
        pendingTool: null,
        mobileMode: 'select',
        wireModeSticky: false,
        endpointAutoBridgeMode: 'auto',
        wiringActive: false,
        isDraggingWireEndpoint: false,
        isTerminalExtending: false,
        isRheostatDragging: false,
        ...overrides
    };
    if (!context.interactionModeStore) {
        const snapshot = createModeStoreContextSnapshot(context);
        context.interactionModeStore = {
            getState: () => ({
                mode: resolveModeFromContext(snapshot),
                context: snapshot
            })
        };
    }
    return context;
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
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
            wiringActive: true,
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
            pendingTool: 'Wire',
            mobileMode: 'wire',
            wireModeSticky: true,
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
            wireModeSticky: true,
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
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false,
            interactionModeStore: {
                getState: () => ({
                    mode: 'wire',
                    context: {
                        pendingTool: 'Wire',
                        mobileMode: 'wire',
                        wireModeSticky: true,
                        wiringActive: true,
                        isDraggingWireEndpoint: false,
                        isTerminalExtending: false,
                        isRheostatDragging: false
                    }
                })
            }
        });

        const snapshot = FakeInteractionManager.prototype.getInteractionModeSnapshot.call(context);
        expect(snapshot.mode).toBe('wire');
        expect(snapshot.pendingTool).toBe('Wire');
        expect(snapshot.wireSignals).toEqual({
            pendingWireTool: true,
            wireModeSelected: true,
            wireModeSticky: true,
            activeWiringSession: true
        });
    });
});
