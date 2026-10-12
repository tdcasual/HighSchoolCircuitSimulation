import { describe, expect, it, vi } from 'vitest';
import {
    APP_DOCUMENT_FORMAT,
    APP_DOCUMENT_VERSION,
    buildAppDocument,
    buildAppSaveData,
    parseAppDocument,
    restoreAppMetaFromSaveData,
    restoreAppUi
} from '../src/app/AppSerialization.js';
import { ErrorCodes } from '../src/core/errors/ErrorCodes.js';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { createComponent } from '../src/components/Component.js';

function bareCircuitPayload(overrides = {}) {
    return {
        meta: { version: 3, name: '电路设计', timestamp: 1760000000000 },
        components: [],
        wires: [],
        ...overrides
    };
}

describe('AppSerialization envelope', () => {
    it('buildAppSaveData puts exercise board and chart workspace in ui, not circuit meta', () => {
        const circuit = {
            toJSON: vi.fn(() => ({
                meta: { version: 3, name: '电路设计' },
                components: [],
                wires: []
            }))
        };
        const exerciseBoard = {
            toJSON: vi.fn(() => ({ mode: 'quiz' }))
        };
        const chartWorkspace = {
            toJSON: vi.fn(() => ({ windows: ['w1'] }))
        };

        const result = buildAppSaveData({
            circuit,
            exerciseBoard,
            chartWorkspace
        });

        expect(result.format).toBe(APP_DOCUMENT_FORMAT);
        expect(result.formatVersion).toBe(APP_DOCUMENT_VERSION);
        expect(result.ui?.exerciseBoard).toEqual({ mode: 'quiz' });
        expect(result.ui?.chartWorkspace).toEqual({ windows: ['w1'] });
        expect(result.circuit.meta?.exerciseBoard).toBeUndefined();
        expect(result.circuit.meta?.chartWorkspace).toBeUndefined();
        expect(result.meta?.exerciseBoard).toBeUndefined();
        expect(exerciseBoard.toJSON).toHaveBeenCalledTimes(1);
        expect(chartWorkspace.toJSON).toHaveBeenCalledTimes(1);
    });

    it('buildAppSaveData ignores non-callable panel serializers', () => {
        const circuit = {
            toJSON: vi.fn(() => ({
                components: [],
                wires: [],
                meta: { version: 3 }
            }))
        };

        const result = buildAppSaveData({
            circuit,
            exerciseBoard: { toJSON: {} },
            chartWorkspace: { toJSON: 'invalid' }
        });

        expect(result.ui?.exerciseBoard).toBeUndefined();
        expect(result.ui?.chartWorkspace).toBeUndefined();
    });

    it('buildAppSaveData does not throw when circuit.toJSON returns a frozen object', () => {
        const frozenPayload = Object.freeze({
            components: [],
            wires: [],
            meta: Object.freeze({ version: 3 })
        });
        const circuit = {
            toJSON: vi.fn(() => frozenPayload)
        };

        expect(() => buildAppSaveData({ circuit })).not.toThrow();

        const result = buildAppSaveData({ circuit });
        expect(result).not.toBe(frozenPayload);
        expect(result.format).toBe(APP_DOCUMENT_FORMAT);
        expect(result.circuit).not.toBe(frozenPayload);
    });

    it('restoreAppMetaFromSaveData reads ui from envelope and legacy meta', () => {
        const exerciseBoard = { fromJSON: vi.fn() };
        const chartWorkspace = { fromJSON: vi.fn() };

        restoreAppMetaFromSaveData({
            exerciseBoard,
            chartWorkspace,
            data: {
                format: APP_DOCUMENT_FORMAT,
                formatVersion: 1,
                circuit: bareCircuitPayload(),
                ui: {
                    exerciseBoard: { chapter: 2 },
                    chartWorkspace: { windows: [] }
                }
            }
        });

        expect(exerciseBoard.fromJSON).toHaveBeenCalledWith({ chapter: 2 });
        expect(chartWorkspace.fromJSON).toHaveBeenCalledWith({ windows: [] });

        exerciseBoard.fromJSON.mockClear();
        chartWorkspace.fromJSON.mockClear();

        restoreAppMetaFromSaveData({
            exerciseBoard,
            chartWorkspace,
            data: {
                meta: {
                    exerciseBoard: { chapter: 9 },
                    chartWorkspace: { windows: ['x'] }
                }
            }
        });

        expect(exerciseBoard.fromJSON).toHaveBeenCalledWith({ chapter: 9 });
        expect(chartWorkspace.fromJSON).toHaveBeenCalledWith({ windows: ['x'] });
    });

    it('restoreAppUi ignores non-callable fromJSON methods', () => {
        expect(() => restoreAppUi({
            exerciseBoard: { fromJSON: {} },
            chartWorkspace: { fromJSON: null },
            ui: { exerciseBoard: { chapter: 1 }, chartWorkspace: { windows: ['x'] } }
        })).not.toThrow();
    });

    it('parseAppDocument unwraps envelope, peels legacy UI meta, and rejects unknown format', () => {
        const envelope = buildAppDocument({
            circuit: {
                toJSON: () => bareCircuitPayload({ components: [{ id: 'R1' }] })
            },
            exerciseBoard: { toJSON: () => ({ markdown: 'x' }) }
        });
        const parsedEnvelope = parseAppDocument(envelope);
        expect(parsedEnvelope.circuit.components).toEqual([{ id: 'R1' }]);
        expect(parsedEnvelope.ui.exerciseBoard).toEqual({ markdown: 'x' });
        expect(parsedEnvelope.recoveredLegacyUi).toBe(false);

        const nested = {
            format: APP_DOCUMENT_FORMAT,
            formatVersion: 1,
            circuit: envelope,
            ui: { chartWorkspace: { charts: [] } }
        };
        const parsedNested = parseAppDocument(nested);
        expect(parsedNested.ui.exerciseBoard).toEqual({ markdown: 'x' });
        expect(parsedNested.ui.chartWorkspace).toEqual({ charts: [] });

        const legacy = {
            meta: {
                version: 3,
                name: '电路设计',
                exerciseBoard: { markdown: 'x' }
            },
            components: [],
            wires: []
        };
        const peeled = parseAppDocument(legacy);
        expect(peeled.recoveredLegacyUi).toBe(true);
        expect(peeled.ui.exerciseBoard).toEqual({ markdown: 'x' });
        expect(peeled.circuit.meta.exerciseBoard).toBeUndefined();
        expect(peeled.circuit.meta.version).toBe(3);

        try {
            parseAppDocument({ format: 'nope', components: [], wires: [] });
            throw new Error('expected throw');
        } catch (error) {
            expect(error.code).toBe(ErrorCodes.IO_ERR_INVALID_DOCUMENT);
        }

        try {
            parseAppDocument({
                format: APP_DOCUMENT_FORMAT,
                formatVersion: 99,
                circuit: bareCircuitPayload(),
                ui: {}
            });
            throw new Error('expected throw');
        } catch (error) {
            expect(error.code).toBe(ErrorCodes.IO_ERR_INVALID_DOCUMENT);
        }

        try {
            parseAppDocument({
                format: APP_DOCUMENT_FORMAT,
                formatVersion: 1,
                circuit: nested,
                ui: {}
            });
            throw new Error('expected throw');
        } catch (error) {
            expect(error.code).toBe(ErrorCodes.IO_ERR_INVALID_DOCUMENT);
            expect(String(error.message)).toMatch(/嵌套信封超过一层/);
        }

        try {
            parseAppDocument(null);
            throw new Error('expected throw');
        } catch (error) {
            expect(error.code).toBe(ErrorCodes.IO_ERR_INVALID_DOCUMENT);
        }

        try {
            parseAppDocument([]);
            throw new Error('expected throw');
        } catch (error) {
            expect(error.code).toBe(ErrorCodes.IO_ERR_INVALID_DOCUMENT);
        }

        try {
            parseAppDocument({ meta: { version: 3 }, wires: [] });
            throw new Error('expected throw');
        } catch (error) {
            expect(error.code).toBe(ErrorCodes.IO_ERR_INVALID_DOCUMENT);
        }

        const unknownMeta = parseAppDocument({
            meta: { version: 3, name: 'x', foo: 1 },
            components: [],
            wires: []
        });
        expect(unknownMeta.circuit.meta.foo).toBe(1);
        expect(unknownMeta.recoveredLegacyUi).toBe(false);
    });

    it('live Circuit save envelope round-trips UI extras without stuffing circuit meta', () => {
        const circuit = new Circuit();
        circuit.addComponent(createComponent('Resistor', 0, 0, 'R1'));
        const exerciseBoard = {
            toJSON: () => ({ markdown: '# q', visible: true, mode: 'preview' })
        };
        const chartWorkspace = {
            toJSON: () => ({ schemaVersion: 2, charts: [] })
        };
        const doc = buildAppDocument({ circuit, exerciseBoard, chartWorkspace });
        expect(doc.format).toBe('hscs-app');
        expect(doc.circuit.meta.exerciseBoard).toBeUndefined();

        const restored = new Circuit();
        restored.addComponent(createComponent('PowerSource', 10, 10, 'Vkeep'));
        restored.fromJSON(parseAppDocument(doc).circuit);
        expect(restored.components.has('R1')).toBe(true);
        expect(restored.components.has('Vkeep')).toBe(false);
    });
});
