import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeRemoveStorageItem } from '../src/app/AppStorage.js';
import { RuntimeStorageEntries } from '../src/app/RuntimeStorageRegistry.js';
import { AppRuntimeV2 } from '../src/app/AppRuntimeV2.js';
import { Circuit } from '../src/core/runtime/Circuit.js';
import { CircuitPersistenceAdapter } from '../src/core/runtime/CircuitPersistenceAdapter.js';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('AppStorage', () => {
    it('CircuitPersistenceAdapter loads and saves solver debug flag safely', () => {
        const storage = {
            getItem: vi.fn(() => 'true'),
            setItem: vi.fn()
        };
        const adapter = new CircuitPersistenceAdapter({ storage });

        expect(adapter.loadSolverDebugFlag()).toBe(true);
        expect(adapter.saveSolverDebugFlag(false)).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith('solver_debug', 'false');
    });

    it('Circuit delegates debug flag IO to injected persistence adapter', () => {
        const persistenceAdapter = {
            loadSolverDebugFlag: vi.fn(() => true),
            saveSolverDebugFlag: vi.fn(() => true)
        };
        const diagnosticsAdapter = {
            build: vi.fn(() => ({ code: 'ok', fatal: false, hints: [] })),
            attach: vi.fn((target, payload) => {
                target.runtimeDiagnostics = payload?.diagnostics || { code: 'ok', fatal: false, hints: [] };
                return target.runtimeDiagnostics;
            })
        };

        const circuit = new Circuit({
            persistenceAdapter,
            diagnosticsAdapter
        });
        circuit.setDebugMode(false);

        expect(persistenceAdapter.loadSolverDebugFlag).toHaveBeenCalledTimes(1);
        expect(persistenceAdapter.saveSolverDebugFlag).toHaveBeenCalledWith(false);
    });

    it('removes storage item when storage is available', () => {
        const storage = {
            removeItem: vi.fn()
        };

        const removed = safeRemoveStorageItem('saved_circuit', { storage });

        expect(removed).toBe(true);
        expect(storage.removeItem).toHaveBeenCalledWith('saved_circuit');
    });

    it('returns false and does not throw when storage is missing', () => {
        expect(() => safeRemoveStorageItem('saved_circuit', { storage: null })).not.toThrow();
        expect(safeRemoveStorageItem('saved_circuit', { storage: null })).toBe(false);
    });

    it('returns false when storage throws remove error', () => {
        const storage = {
            removeItem: vi.fn(() => {
                throw new Error('blocked');
            })
        };

        const removed = safeRemoveStorageItem('saved_circuit', { storage });

        expect(removed).toBe(false);
        expect(storage.removeItem).toHaveBeenCalledWith('saved_circuit');
    });

    it('writes autosave metadata alongside circuit payload when ownership sequence matches', () => {
        const storage = {
            setItem: vi.fn()
        };
        const runtime = {
            buildSaveData: vi.fn(() => ({ components: [{ id: 'R1' }], wires: [] })),
            circuitStorageOwnership: { source: 'manual-import', sequence: 3 }
        };

        const saved = AppRuntimeV2.prototype.saveCircuitToStorage.call(runtime, null, {
            storage,
            source: 'autosave',
            expectedSequence: 3
        });

        expect(saved).toBe(true);
        expect(storage.setItem).toHaveBeenCalledWith(
            RuntimeStorageEntries.circuitAutosave.key,
            JSON.stringify({ components: [{ id: 'R1' }], wires: [] })
        );
        expect(storage.setItem).toHaveBeenCalledWith(
            RuntimeStorageEntries.circuitAutosaveMeta.key,
            JSON.stringify({
                owner: RuntimeStorageEntries.circuitAutosave.owner,
                source: 'autosave',
                sequence: 3
            })
        );
    });

    it('rejects stale autosave writes when ownership sequence changed before debounce flush', () => {
        const storage = {
            setItem: vi.fn()
        };
        const runtime = {
            buildSaveData: vi.fn(() => ({ components: [{ id: 'R1' }], wires: [] })),
            circuitStorageOwnership: { source: 'manual-import', sequence: 4 }
        };

        const saved = AppRuntimeV2.prototype.saveCircuitToStorage.call(runtime, null, {
            storage,
            source: 'autosave',
            expectedSequence: 3
        });

        expect(saved).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('captures ownership sequence when scheduling autosave writes', () => {
        vi.useFakeTimers();
        const saveCircuitToStorage = vi.fn(() => true);
        const onCircuitUpdate = vi.fn();
        const runtime = {
            circuit: {},
            circuitStorageOwnership: { source: 'runtime-load', sequence: 7 },
            onCircuitUpdate,
            saveCircuitToStorage,
            logger: {
                error: vi.fn()
            }
        };

        AppRuntimeV2.prototype.setupAutoSave.call(runtime, { enabled: true });
        runtime.circuit.onUpdate({ valid: true });
        runtime.circuitStorageOwnership = { source: 'manual-import', sequence: 8 };
        vi.advanceTimersByTime(1000);

        expect(onCircuitUpdate).toHaveBeenCalledWith({ valid: true });
        expect(saveCircuitToStorage).toHaveBeenCalledWith(null, {
            source: 'autosave',
            expectedSequence: 7
        });
    });
});
