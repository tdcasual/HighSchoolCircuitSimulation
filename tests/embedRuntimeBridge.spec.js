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
    const observationTab = { hidden: false };
    const observationPanel = {
        hidden: false,
        setAttribute: vi.fn()
    };

    const doc = {
        body,
        querySelector: vi.fn((selector) => {
            if (selector === '.panel-tab-btn[data-panel="observation"]') return observationTab;
            return null;
        }),
        getElementById: vi.fn((id) => {
            if (id === 'panel-observation') return observationPanel;
            return null;
        })
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
        observationTab,
        observationPanel,
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
});

describe('EmbedRuntimeBridge', () => {
    it('applies readonly defaults and handles core API methods', () => {
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
        expect(fixture.observationTab.hidden).toBe(true);

        const exportResult = bridge.handleRequest('exportCircuit');
        expect(exportResult).toEqual({
            circuit: { components: [], wires: [] }
        });

        bridge.handleRequest('run');
        expect(fixture.app.startSimulation).toHaveBeenCalledTimes(1);

        const state = bridge.handleRequest('getState');
        expect(state.mode).toBe('readonly');
        expect(state.isRunning).toBe(true);
    });
});
