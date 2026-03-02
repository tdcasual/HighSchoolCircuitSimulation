import { describe, expect, it, vi } from 'vitest';
import { safeRemoveStorageItem } from '../src/app/AppStorage.js';
import { Circuit } from '../src/engine/Circuit.js';
import { CircuitPersistenceAdapter } from '../src/engine/runtime/CircuitPersistenceAdapter.js';

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
});
