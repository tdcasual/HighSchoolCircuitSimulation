import { describe, expect, it, vi } from 'vitest';
import { EmbedRuntimeBridge, parseEmbedRuntimeOptionsFromSearch } from '../src/embed/EmbedRuntimeBridge.js';

function createClassList() {
    const values = new Set();
    return {
        add: (...classes) => classes.forEach((name) => values.add(name)),
        remove: (...classes) => classes.forEach((name) => values.delete(name)),
        toggle: (name, force) => {
            if (force === undefined) {
                if (values.has(name)) {
                    values.delete(name);
                    return false;
                }
                values.add(name);
                return true;
            }
            if (force) {
                values.add(name);
            } else {
                values.delete(name);
            }
            return !!force;
        },
        contains: (name) => values.has(name),
        _values: values
    };
}

function createBridgeFixture() {
    const body = { classList: createClassList() };
    const doc = {
        body,
        querySelector: vi.fn(() => null),
        getElementById: vi.fn(() => null)
    };

    const listeners = new Map();
    const parentWindow = {
        postMessage: vi.fn()
    };
    const win = {
        parent: parentWindow,
        setTimeout,
        clearTimeout,
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        removeEventListener: vi.fn((eventName, handler) => {
            const current = listeners.get(eventName);
            if (current === handler) listeners.delete(eventName);
        })
    };

    const app = {
        circuit: {
            isRunning: false,
            components: new Map([['R1', {}]]),
            wires: new Map([['W1', {}]])
        },
        classroomMode: {
            activeLevel: 'off'
        },
        interaction: {
            activateSidePanelTab: vi.fn()
        },
        logger: {
            child: vi.fn(() => ({
                error: vi.fn()
            }))
        },
        updateStatus: vi.fn(),
        startSimulation: vi.fn(() => {
            app.circuit.isRunning = true;
        }),
        stopSimulation: vi.fn(() => {
            app.circuit.isRunning = false;
        }),
        clearCircuit: vi.fn(),
        loadCircuitData: vi.fn(() => ({ componentCount: 1, wireCount: 0 })),
        buildSaveData: vi.fn(() => ({ components: [], wires: [] })),
        setClassroomModeLevel: vi.fn((level) => {
            app.classroomMode.activeLevel = level;
            return { preferredLevel: level, activeLevel: level, supported: true };
        })
    };

    return {
        body,
        doc,
        win,
        parentWindow,
        app
    };
}

describe('parseEmbedRuntimeOptionsFromSearch', () => {
    it('parses embed options from query string', () => {
        const options = parseEmbedRuntimeOptionsFromSearch(
            '?embed=1&mode=classroom&classroomLevel=enhanced&targetOrigin=https%3A%2F%2Flms.example&toolbox=0&ai=1&autosave=1&restore=1'
        );

        expect(options.enabled).toBe(true);
        expect(options.mode).toBe('classroom');
        expect(options.classroomLevel).toBe('enhanced');
        expect(options.targetOrigin).toBe('https://lms.example');
        expect(options.features.toolbox).toBe(false);
        expect(options.features.ai).toBe(true);
        expect(options.autoSave).toBe(true);
        expect(options.restoreFromStorage).toBe(true);
    });

    it('keeps non-embed defaults compatible with normal runtime', () => {
        const options = parseEmbedRuntimeOptionsFromSearch('');
        expect(options.enabled).toBe(false);
        expect(options.autoSave).toBe(true);
        expect(options.restoreFromStorage).toBe(true);
    });

    it('defaults allowed origins to targetOrigin when allowlist is omitted', () => {
        const options = parseEmbedRuntimeOptionsFromSearch(
            '?embed=1&targetOrigin=https%3A%2F%2Flms.example'
        );
        expect(options.targetOrigin).toBe('https://lms.example');
        expect(options.allowedParentOrigins).toEqual(['https://lms.example']);
    });

    it('disables embed when parent origin is empty or wildcard', () => {
        const empty = parseEmbedRuntimeOptionsFromSearch('?embed=1');
        expect(empty.enabled).toBe(false);
        expect(empty.targetOrigin).toBe('');
        expect(empty.allowedParentOrigins).toEqual([]);

        const wildcard = parseEmbedRuntimeOptionsFromSearch('?embed=1&targetOrigin=*');
        expect(wildcard.enabled).toBe(false);
        expect(wildcard.allowedParentOrigins).toEqual([]);
    });

    it('parses unfreeze capability from query', () => {
        const options = parseEmbedRuntimeOptionsFromSearch(
            '?embed=1&targetOrigin=https%3A%2F%2Flms.example&capabilities=unfreeze'
        );
        expect(options.capabilities.unfreeze).toBe(true);
        expect(options.enabled).toBe(true);
        expect(options.capabilities.unfreeze).toBe(true);
        expect(options.solverBackend).toBe('v2');
        expect(options.solverBackendExplicit).toBe(false);
    });

    it('pins solverBackend=v2 for embed when solver is not explicit', () => {
        const pinned = parseEmbedRuntimeOptionsFromSearch(
            '?embed=1&targetOrigin=https%3A%2F%2Flms.example'
        );
        expect(pinned.enabled).toBe(true);
        expect(pinned.solverBackend).toBe('v2');
        expect(pinned.solverBackendExplicit).toBe(false);
        expect(pinned.capabilities.unfreeze).toBe(false);
    });

    it('honors explicit solver= on embed and classroom query without stuffing capabilities', () => {
        const embedV2 = parseEmbedRuntimeOptionsFromSearch(
            '?embed=1&targetOrigin=https%3A%2F%2Flms.example&solver=v2'
        );
        expect(embedV2.enabled).toBe(true);
        expect(embedV2.solverBackend).toBe('v2');
        expect(embedV2.solverBackendExplicit).toBe(true);

        const classroomShadow = parseEmbedRuntimeOptionsFromSearch('?solver=shadow&shadowThrow=1');
        expect(classroomShadow.enabled).toBe(false);
        expect(classroomShadow.solverBackend).toBeUndefined();
        expect(classroomShadow.solverBackendExplicit).toBe(false);
        expect(classroomShadow.shadowThrow).toBe(true);

        const unknown = parseEmbedRuntimeOptionsFromSearch(
            '?embed=1&targetOrigin=https%3A%2F%2Flms.example&solver=experimental'
        );
        expect(unknown.solverBackend).toBe('v2');
        expect(unknown.solverBackendExplicit).toBe(false);

        const classroomDefault = parseEmbedRuntimeOptionsFromSearch('');
        expect(classroomDefault.solverBackend).toBeUndefined();
        expect(classroomDefault.solverBackendExplicit).toBe(false);
    });
});

describe('EmbedRuntimeBridge', () => {
    it('applies readonly defaults and handles read-only API methods', () => {
        const fixture = createBridgeFixture();
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            {
                enabled: true,
                mode: 'readonly',
                targetOrigin: 'https://host.example'
            },
            {
                window: fixture.win,
                document: fixture.doc
            }
        );

        expect(fixture.body.classList.contains('embed-runtime')).toBe(true);
        expect(fixture.body.classList.contains('embed-mode-readonly')).toBe(true);
        expect(fixture.body.classList.contains('embed-hide-toolbox')).toBe(true);
        expect(fixture.body.classList.contains('embed-hide-side-panel')).toBe(true);

        const exportResult = bridge.handleRequest('exportCircuit');
        expect(exportResult).toEqual({
            circuit: { components: [], wires: [] }
        });

        const state = bridge.handleRequest('getState');
        expect(state.mode).toBe('readonly');
        expect(state.readOnly).toBe(true);
        expect(state.isRunning).toBe(false);
    });

    it('handles mutation API methods in edit mode', () => {
        const fixture = createBridgeFixture();
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            {
                enabled: true,
                mode: 'edit',
                targetOrigin: 'https://host.example'
            },
            {
                window: fixture.win,
                document: fixture.doc
            }
        );

        bridge.handleRequest('run');
        expect(fixture.app.startSimulation).toHaveBeenCalledTimes(1);

        expect(fixture.win.addEventListener).toHaveBeenCalled();
        const loadResult = bridge.handleRequest('loadCircuit', {
            circuit: { components: [], wires: [] }
        });
        expect(fixture.app.loadCircuitData).toHaveBeenCalledTimes(1);
        expect(loadResult.summary).toEqual({ componentCount: 1, wireCount: 0 });

        bridge.handleRequest('clearCircuit');
        expect(fixture.app.clearCircuit).toHaveBeenCalledTimes(1);
    });

    it('initialize keeps running when message listener registration throws', () => {
        const fixture = createBridgeFixture();
        fixture.win.addEventListener = vi.fn(() => {
            throw new Error('listener registration failed');
        });

        expect(() => {
            new EmbedRuntimeBridge(
                fixture.app,
                { enabled: true, mode: 'readonly', targetOrigin: 'https://host.example' },
                { window: fixture.win, document: fixture.doc }
            );
        }).not.toThrow();
        expect(fixture.body.classList.contains('embed-runtime')).toBe(true);
    });

    it('destroy ignores removeEventListener failures', () => {
        const fixture = createBridgeFixture();
        fixture.win.removeEventListener = vi.fn(() => {
            throw new Error('listener removal failed');
        });
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            { enabled: false },
            { window: fixture.win, document: fixture.doc }
        );

        expect(() => bridge.destroy()).not.toThrow();
    });

    it('applyRuntimeOptions ignores classList.add failures', () => {
        const fixture = createBridgeFixture();
        fixture.body.classList.add = vi.fn(() => {
            throw new Error('classList.add failed');
        });
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            { enabled: false },
            { window: fixture.win, document: fixture.doc }
        );

        expect(() => bridge.applyRuntimeOptions()).not.toThrow();
    });

    it('applyMode ignores classList.toggle failures', () => {
        const fixture = createBridgeFixture();
        fixture.body.classList.toggle = vi.fn(() => {
            throw new Error('classList.toggle failed');
        });
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            { enabled: false },
            { window: fixture.win, document: fixture.doc }
        );

        expect(() => bridge.applyMode('readonly')).not.toThrow();
        expect(bridge.mode).toBe('readonly');
    });

    it('applyFeatures keeps unknown flags harmless', () => {
        const fixture = createBridgeFixture();
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            { enabled: false },
            { window: fixture.win, document: fixture.doc }
        );

        expect(() => bridge.applyFeatures({ sidePanel: false, unknownFeature: true })).not.toThrow();
        expect(fixture.body.classList.contains('embed-hide-side-panel')).toBe(true);
    });

    it('does not listen when origin allowlist is empty or wildcard', () => {
        const fixture = createBridgeFixture();
        const empty = new EmbedRuntimeBridge(
            fixture.app,
            { enabled: true, mode: 'edit' },
            { window: fixture.win, document: fixture.doc }
        );
        expect(empty.enabled).toBe(false);
        expect(fixture.win.addEventListener).not.toHaveBeenCalled();

        const wildcard = new EmbedRuntimeBridge(
            fixture.app,
            { enabled: true, mode: 'edit', targetOrigin: '*', allowedParentOrigins: ['*'] },
            { window: fixture.win, document: fixture.doc }
        );
        expect(wildcard.enabled).toBe(false);
    });

    it('denies leaving readonly without unfreeze capability', () => {
        const fixture = createBridgeFixture();
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            { enabled: true, mode: 'readonly', targetOrigin: 'https://host.example' },
            { window: fixture.win, document: fixture.doc }
        );
        try {
            bridge.handleRequest('setReadonly', { readOnly: false });
            throw new Error('expected throw');
        } catch (error) {
            expect(error.code).toBe('CAPABILITY_DENIED');
        }
    });

    it('allows leaving readonly when unfreeze capability is present', () => {
        const fixture = createBridgeFixture();
        const bridge = new EmbedRuntimeBridge(
            fixture.app,
            {
                enabled: true,
                mode: 'readonly',
                targetOrigin: 'https://host.example',
                capabilities: { unfreeze: true }
            },
            { window: fixture.win, document: fixture.doc }
        );
        const snapshot = bridge.handleRequest('setReadonly', { readOnly: false });
        expect(bridge.readOnly).toBe(false);
        expect(snapshot).toBeTruthy();
    });
});
