import { afterEach, describe, expect, it, vi } from 'vitest';
import * as PropertyDialogActions from '../src/ui/interaction/PropertyDialogActions.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('PropertyDialogActions.applyDialogChanges', () => {
    it('returns early when no editing component', () => {
        const ctx = {
            editingComponent: null,
            runWithHistory: vi.fn()
        };

        PropertyDialogActions.applyDialogChanges.call(ctx);

        expect(ctx.runWithHistory).not.toHaveBeenCalled();
    });

    it('updates resistor property and refreshes renderer', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'edit-resistance') return { value: '220' };
                return { value: '' };
            })
        });

        const comp = { id: 'R1', type: 'Resistor', resistance: 100 };
        const ctx = {
            editingComponent: comp,
            safeParseFloat: vi.fn((v) => parseFloat(v)),
            runWithHistory: vi.fn((_, action) => action()),
            circuit: { markSolverCircuitDirty: vi.fn() },
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn(),
                updateConnectedWires: vi.fn(),
                render: vi.fn()
            },
            updatePropertyPanel: vi.fn(),
            hideDialog: vi.fn(),
            updateStatus: vi.fn(),
            selectComponent: vi.fn(),
            recomputeParallelPlateCapacitance: vi.fn()
        };

        PropertyDialogActions.applyDialogChanges.call(ctx);

        expect(comp.resistance).toBe(220);
        expect(ctx.circuit.markSolverCircuitDirty).toHaveBeenCalledTimes(1);
        expect(ctx.renderer.refreshComponent).toHaveBeenCalledWith(comp);
        expect(ctx.renderer.setSelected).toHaveBeenCalledWith('R1', true);
        expect(ctx.renderer.updateConnectedWires).toHaveBeenCalledWith('R1');
        expect(ctx.updatePropertyPanel).toHaveBeenCalledWith(comp);
        expect(ctx.hideDialog).toHaveBeenCalledTimes(1);
        expect(ctx.updateStatus).toHaveBeenCalledWith('属性已更新');
    });

    it('reports status when apply fails', () => {
        vi.stubGlobal('document', { getElementById: vi.fn(() => ({ value: '' })) });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const ctx = {
            editingComponent: { id: 'R1', type: 'Resistor' },
            runWithHistory: vi.fn(() => {
                throw new Error('boom');
            }),
            updateStatus: vi.fn()
        };

        PropertyDialogActions.applyDialogChanges.call(ctx);

        expect(ctx.updateStatus).toHaveBeenCalledWith('更新失败：boom');
    });

    it('does not throw when resistor field is missing', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'edit-resistance') return null;
                return { value: '' };
            })
        });

        const comp = { id: 'R1', type: 'Resistor', resistance: 330 };
        const ctx = {
            editingComponent: comp,
            safeParseFloat: vi.fn((value, fallback) => {
                const parsed = Number.parseFloat(value);
                return Number.isFinite(parsed) ? parsed : fallback;
            }),
            runWithHistory: vi.fn((_, action) => action()),
            circuit: { markSolverCircuitDirty: vi.fn() },
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn(),
                updateConnectedWires: vi.fn()
            },
            updatePropertyPanel: vi.fn(),
            hideDialog: vi.fn(),
            updateStatus: vi.fn(),
            selectComponent: vi.fn(),
            recomputeParallelPlateCapacitance: vi.fn()
        };

        expect(() => PropertyDialogActions.applyDialogChanges.call(ctx)).not.toThrow();
        expect(comp.resistance).toBe(100);
        expect(ctx.circuit.markSolverCircuitDirty).toHaveBeenCalledTimes(1);
        expect(ctx.hideDialog).toHaveBeenCalledTimes(1);
        expect(ctx.updateStatus).toHaveBeenCalledWith('属性已更新');
    });

    it('does not throw when voltmeter fields are missing', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'edit-resistance' || id === 'edit-range') return null;
                return { value: '' };
            })
        });

        const comp = { id: 'V1', type: 'Voltmeter', resistance: 1000, range: 5 };
        const ctx = {
            editingComponent: comp,
            safeParseFloat: vi.fn((value, fallback) => {
                const parsed = Number.parseFloat(value);
                return Number.isFinite(parsed) ? parsed : fallback;
            }),
            runWithHistory: vi.fn((_, action) => action()),
            circuit: { markSolverCircuitDirty: vi.fn() },
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn(),
                updateConnectedWires: vi.fn()
            },
            updatePropertyPanel: vi.fn(),
            hideDialog: vi.fn(),
            updateStatus: vi.fn(),
            selectComponent: vi.fn(),
            recomputeParallelPlateCapacitance: vi.fn()
        };

        expect(() => PropertyDialogActions.applyDialogChanges.call(ctx)).not.toThrow();
        expect(comp.resistance).toBe(Infinity);
        expect(comp.range).toBe(15);
        expect(ctx.circuit.markSolverCircuitDirty).toHaveBeenCalledTimes(1);
        expect(ctx.hideDialog).toHaveBeenCalledTimes(1);
        expect(ctx.updateStatus).toHaveBeenCalledWith('属性已更新');
    });

    it('does not throw when switch-close classList contains is non-callable', () => {
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'switch-close') {
                    return {
                        classList: {
                            contains: {}
                        }
                    };
                }
                return { value: '' };
            })
        });

        const comp = { id: 'S1', type: 'Switch', closed: true };
        const ctx = {
            editingComponent: comp,
            safeParseFloat: vi.fn((value, fallback) => {
                const parsed = Number.parseFloat(value);
                return Number.isFinite(parsed) ? parsed : fallback;
            }),
            runWithHistory: vi.fn((_, action) => action()),
            circuit: { markSolverCircuitDirty: vi.fn() },
            renderer: {
                refreshComponent: vi.fn(),
                setSelected: vi.fn(),
                updateConnectedWires: vi.fn()
            },
            updatePropertyPanel: vi.fn(),
            hideDialog: vi.fn(),
            updateStatus: vi.fn(),
            selectComponent: vi.fn(),
            recomputeParallelPlateCapacitance: vi.fn()
        };

        expect(() => PropertyDialogActions.applyDialogChanges.call(ctx)).not.toThrow();
        expect(comp.closed).toBe(false);
        expect(ctx.circuit.markSolverCircuitDirty).toHaveBeenCalledTimes(1);
        expect(ctx.hideDialog).toHaveBeenCalledTimes(1);
    });
});
