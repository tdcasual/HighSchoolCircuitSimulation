import { describe, expect, it } from 'vitest';
import { RuntimeActionRouter } from '../src/app/RuntimeActionRouter.js';
import { HistoryManager } from '../src/ui/interaction/HistoryManager.js';
import { applyComponentPropertyDialogChanges } from '../src/ui/interaction/ComponentPropertySchema.js';
import { safeParseFloat } from '../src/ui/interaction/UIStateController.js';
import { limitJunctionStep, resolveJunctionParameters, solveJunctionCurrent } from '../src/v2/simulation/JunctionModelV2.js';
import { solveCircuitV2 } from '../src/v2/simulation/SolveCircuitV2.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { addComponent, connectWire, createTestCircuit, solveCircuit } from './helpers/circuitTestUtils.js';
import { solveV2FromCircuit } from './helpers/solverParityHarness.js';

describe('SolveCircuitV2 Shockley junction', () => {
    it('keeps diode I-V transition continuous around the forward knee', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 0.7, internalResistance: 0 });
        const diode = addComponent(circuit, 'Diode', 'D1');
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        const readCurrentAt = (voltage) => {
            source.voltage = voltage;
            const { result } = solveV2FromCircuit(circuit);
            expect(result.valid).toBe(true);
            return Math.abs(result.currents.get('D1') || 0);
        };

        const iLow = readCurrentAt(0.69);
        const iHigh = readCurrentAt(0.71);

        expect(iLow).toBeGreaterThan(0);
        expect(iHigh).toBeGreaterThan(iLow);
        expect(iHigh / iLow).toBeLessThan(1e4);
    });

    it('limits reverse diode leakage to microamp-level instead of ohmic reverse conduction', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 5, internalResistance: 0 });
        const diode = addComponent(circuit, 'Diode', 'D1');
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });

        connectWire(circuit, 'W1', source, 0, diode, 1);
        connectWire(circuit, 'W2', diode, 0, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        const production = solveCircuit(circuit);
        const { result } = solveV2FromCircuit(circuit);
        expect(result.valid).toBe(true);
        expect(production.valid).toBe(true);

        const reverseCurrent = Math.abs(result.currents.get('D1') || 0);
        expect(reverseCurrent).toBeGreaterThan(0);
        expect(reverseCurrent).toBeLessThan(1e-9);
        expect(reverseCurrent).toBeCloseTo(Math.abs(production.currents.get('D1') || 0), 12);
    });

    it('solves LED forward current around Vf=2 V and clamps reverse leakage', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 0 });
        addComponent(circuit, 'LED', 'LED1', { forwardVoltage: 2, onResistance: 2, ratedCurrent: 0.02 });
        addComponent(circuit, 'Resistor', 'R1', { resistance: 50 });
        connectWire(circuit, 'W1', source, 0, 'LED1', 0);
        connectWire(circuit, 'W2', 'LED1', 1, 'R1', 0);
        connectWire(circuit, 'W3', 'R1', 1, source, 1);

        const forward = solveV2FromCircuit(circuit).result;
        expect(forward.valid).toBe(true);
        expect(forward.currents.get('LED1')).toBeGreaterThan(0.01);

        source.voltage = -5;
        const reverse = solveV2FromCircuit(circuit).result;
        expect(reverse.valid).toBe(true);
        expect(Math.abs(reverse.currents.get('LED1') || 0)).toBeLessThan(1e-9);
    });

    it('limitJunctionStep clamps a huge predicted step instead of jumping to vNew', () => {
        const params = resolveJunctionParameters({ type: 'Diode', onResistance: 0 });
        const limited = limitJunctionStep(10, 0, params);
        expect(Number.isFinite(limited)).toBe(true);
        expect(limited).toBeLessThan(1);
        expect(limited).toBeGreaterThan(0);
    });

    it('tracks the solved branch voltage when series R bounds conductance', () => {
        const params = resolveJunctionParameters({ type: 'Diode' });
        expect(params.seriesResistance).toBeGreaterThan(0);
        expect(limitJunctionStep(10, 0, params)).toBe(10);
    });

    it('log-limits a junk jump above the source scale even when series R is positive', () => {
        const params = resolveJunctionParameters({ type: 'Diode' });
        const limited = limitJunctionStep(60, 0.7, {
            ...params,
            capHugeJunctionSteps: true,
            maxAbsJunctionVoltage: 17
        });
        expect(limited).toBeLessThan(5);
        expect(limited).toBeGreaterThan(0.7);
        const reverseLandedInside = limitJunctionStep(27.31, -2.6, {
            ...params,
            capHugeJunctionSteps: true,
            maxAbsJunctionVoltage: 17
        });
        expect(reverseLandedInside).toBeLessThan(5);
        expect(reverseLandedInside).toBeGreaterThan(-2.6);
        expect(limitJunctionStep(500, 0, {
            ...params,
            capHugeJunctionSteps: true,
            maxAbsJunctionVoltage: 500
        })).toBe(500);
        expect(limitJunctionStep(44.6, 500, {
            ...params,
            capHugeJunctionSteps: true,
            maxAbsJunctionVoltage: 500
        })).toBe(44.6);
        expect(limitJunctionStep(60, 0.7, {
            ...params,
            capHugeJunctionSteps: true,
            maxAbsJunctionVoltage: 500
        })).toBe(60);
        expect(limitJunctionStep(60, 0.7, params)).toBe(60);
    });

    it('starts a default battery wired straight to a default LED', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const led = addComponent(circuit, 'LED', 'D1', {});
        connectWire(circuit, 'W1', source, 0, led, 0);
        connectWire(circuit, 'W2', led, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0)).toBeGreaterThan(0.5);
    });

    it('starts a default battery wired straight to a default diode', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0)).toBeGreaterThan(1);
    });

    it('bisects Shockley plus dialog-minimum series R to the independent forward root', () => {
        const params = resolveJunctionParameters({ type: 'Diode', onResistance: 1e-9 });
        expect(solveJunctionCurrent(0.88297692942, params)).toBeCloseTo(0.05091565244, 8);
        expect(solveJunctionCurrent(-6, params)).toBeCloseTo(-params.saturationCurrent, 12);
    });

    it('starts a default battery, 100 ohm, and a diode at dialog-minimum on-resistance', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        const current = Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0);
        expect(current).toBeGreaterThan(0.04);
        expect(current).toBeLessThan(0.06);
    });

    it('starts a dialog-saved 12 V battery wired straight to a default diode', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        applyComponentPropertyDialogChanges({
            component: source,
            readFieldValue: (id) => (id === 'edit-voltage' ? '12' : id === 'edit-internal-resistance' ? '0.5' : ''),
            safeParseFloat
        });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0)).toBeGreaterThan(5);
    });

    it('starts a dialog-saved 12 V battery wired straight to a default LED', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        applyComponentPropertyDialogChanges({
            component: source,
            readFieldValue: (id) => (id === 'edit-voltage' ? '12' : id === 'edit-internal-resistance' ? '0.5' : ''),
            safeParseFloat
        });
        const led = addComponent(circuit, 'LED', 'D1', {});
        connectWire(circuit, 'W1', source, 0, led, 0);
        connectWire(circuit, 'W2', led, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0)).toBeGreaterThan(2);
    });

    it('starts a default battery, 100 ohm, and an LED at dialog-minimum on-resistance', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const led = addComponent(circuit, 'LED', 'D1', { onResistance: 1e-9 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, led, 0);
        connectWire(circuit, 'W2', led, 1, resistor, 0);
        connectWire(circuit, 'W3', resistor, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        const current = Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0);
        expect(current).toBeGreaterThan(0.03);
        expect(current).toBeLessThan(0.05);
    });

    it('starts five series LEDs at dialog-minimum on-resistance', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 6, internalResistance: 0.5 });
        const leds = [];
        for (let i = 0; i < 5; i += 1) {
            const led = addComponent(circuit, 'LED', `D${i}`, {});
            applyComponentPropertyDialogChanges({
                component: led,
                readFieldValue: (id) => {
                    if (id === 'edit-on-resistance') return '1e-9';
                    if (id === 'edit-forward-voltage') return '2';
                    if (id === 'edit-off-resistance') return '1e9';
                    if (id === 'edit-rated-current') return '20';
                    return '';
                },
                safeParseFloat
            });
            leds.push(led);
        }
        connectWire(circuit, 'W0', source, 0, leds[0], 0);
        for (let i = 1; i < 5; i += 1) {
            connectWire(circuit, `W${i}`, leds[i - 1], 1, leds[i], 0);
        }
        connectWire(circuit, 'W5', leds[4], 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        const current = Math.abs(circuit.lastResults.viewMap.get('D0')?.currentValue || 0);
        expect(current).toBeGreaterThan(1e-9);
        expect(current).toBeLessThan(1e-6);
    });

    it('starts a blown fuse in series with a dialog-min LED after save/load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 12, internalResistance: 0.5 });
        const fuse = addComponent(circuit, 'Fuse', 'F1', {
            blown: true,
            blownResistance: 1e12,
            coldResistance: 0.05,
            ratedCurrent: 3,
            i2tThreshold: 1
        });
        const led = addComponent(circuit, 'LED', 'D1', { onResistance: 1e-9 });
        connectWire(circuit, 'W1', source, 0, fuse, 0);
        connectWire(circuit, 'W2', fuse, 1, led, 0);
        connectWire(circuit, 'W3', led, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        expect(new RuntimeActionRouter({ circuit: restored }).startSimulation()).toBe(true);
        restored.step();
        expect(restored.lastResults.valid).toBe(true);
        expect(restored.lastResults.backendUsed).toBe('v2');
        expect(restored.lastResults.meta?.converged).toBe(true);
    });

    it('starts a default AC bridge rectifier with a default capacitor', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', {});
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const d3 = addComponent(circuit, 'Diode', 'D3', {});
        const d4 = addComponent(circuit, 'Diode', 'D4', {});
        const cap = addComponent(circuit, 'Capacitor', 'X', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, d3, 0);
        connectWire(circuit, 'W6', d3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, d4, 0);
        connectWire(circuit, 'W8', d4, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 20; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }
        expect(Math.abs(circuit.lastResults.viewMap.get('X')?.voltageValue || 0)).toBeGreaterThan(10);
    });

    it('starts a 500 Hz AC bridge rectifier with a default capacitor after save/load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 500 });
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const d3 = addComponent(circuit, 'Diode', 'D3', {});
        const d4 = addComponent(circuit, 'Diode', 'D4', {});
        const cap = addComponent(circuit, 'Capacitor', 'X', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, d3, 0);
        connectWire(circuit, 'W6', d3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, d4, 0);
        connectWire(circuit, 'W8', d4, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        expect(new RuntimeActionRouter({ circuit: restored }).startSimulation()).toBe(true);
        restored.step();
        expect(restored.lastResults.valid).toBe(true);
        expect(restored.lastResults.backendUsed).toBe('v2');
        expect(restored.lastResults.meta?.converged).toBe(true);
    });

    it('starts a 1200 Hz AC bridge rectifier with a default capacitor after save/load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 1200 });
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const d3 = addComponent(circuit, 'Diode', 'D3', {});
        const d4 = addComponent(circuit, 'Diode', 'D4', {});
        const cap = addComponent(circuit, 'Capacitor', 'X', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, d3, 0);
        connectWire(circuit, 'W6', d3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, d4, 0);
        connectWire(circuit, 'W8', d4, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        expect(new RuntimeActionRouter({ circuit: restored }).startSimulation()).toBe(true);
        restored.step();
        expect(restored.lastResults.valid).toBe(true);
        expect(restored.lastResults.backendUsed).toBe('v2');
        expect(restored.lastResults.meta?.converged).toBe(true);
    });

    it('starts a 2000 Hz AC half-wave rectifier with a default parallel-plate capacitor after save/load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 2000 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'ParallelPlateCapacitor', 'C1', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, cap, 0);
        connectWire(circuit, 'W3', cap, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        expect(new RuntimeActionRouter({ circuit: restored }).startSimulation()).toBe(true);
        restored.step();
        expect(restored.lastResults.valid).toBe(true);
        expect(restored.lastResults.backendUsed).toBe('v2');
        expect(restored.lastResults.meta?.converged).toBe(true);
    });

    it('starts a 500 Hz AC bridge after history undo restores capacitor-first order', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 500 });
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const d3 = addComponent(circuit, 'Diode', 'D3', {});
        const d4 = addComponent(circuit, 'Diode', 'D4', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, d3, 0);
        connectWire(circuit, 'W6', d3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, d4, 0);
        connectWire(circuit, 'W8', d4, 1, source, 1);

        const history = new HistoryManager({ circuit, updateStatus() {}, logger: { error() {} } });
        history.runWithHistory('add dummy', () => {
            addComponent(circuit, 'Resistor', 'Rdummy', { resistance: 1e12 });
        });
        history.undo();
        expect(circuit.components.has('Rdummy')).toBe(false);
        expect([...circuit.components.keys()]).toEqual(['C', 'D1', 'D2', 'D3', 'D4', 'S']);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        expect(new RuntimeActionRouter({ circuit: restored }).startSimulation()).toBe(true);
        restored.step();
        expect(restored.lastResults.valid).toBe(true);
        expect(restored.lastResults.backendUsed).toBe('v2');
        expect(restored.lastResults.meta?.converged).toBe(true);
    });

    it('starts an 1800 Hz min-Ron LED bridge after history undo restores capacitor-first order', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 1800 });
        const l1 = addComponent(circuit, 'LED', 'L1', { onResistance: 1e-9 });
        const l2 = addComponent(circuit, 'LED', 'L2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, l1, 0);
        connectWire(circuit, 'W2', l1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, l2, 0);
        connectWire(circuit, 'W4', l2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);

        const history = new HistoryManager({ circuit, updateStatus() {}, logger: { error() {} } });
        history.runWithHistory('add dummy', () => {
            addComponent(circuit, 'Resistor', 'Rdummy', { resistance: 1e12 });
        });
        history.undo();
        expect(circuit.components.has('Rdummy')).toBe(false);
        expect([...circuit.components.keys()]).toEqual(['C', 'L1', 'L2', 'L3', 'L4', 'S']);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        expect(new RuntimeActionRouter({ circuit: restored }).startSimulation()).toBe(true);
        restored.step();
        expect(restored.lastResults.valid).toBe(true);
        expect(restored.lastResults.backendUsed).toBe('v2');
        expect(restored.lastResults.meta?.converged).toBe(true);
    });

    it('starts two stacked 2000V batteries with a default diode and capacitor', () => {
        const circuit = createTestCircuit();
        const source1 = addComponent(circuit, 'PowerSource', 'V1', { voltage: 2000, internalResistance: 0.5 });
        const source2 = addComponent(circuit, 'PowerSource', 'V2', { voltage: 2000, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source1, 0, source2, 1);
        connectWire(circuit, 'W2', source2, 0, diode, 0);
        connectWire(circuit, 'W3', diode, 1, source1, 1);
        connectWire(circuit, 'W4', source2, 0, cap, 0);
        connectWire(circuit, 'W5', cap, 1, source1, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 3; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
            expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
        }
    });

    it('starts a 500V battery, default diode, and default capacitor', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 500, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, cap, 0);
        connectWire(circuit, 'W3', cap, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a 100V battery wired straight to a default diode', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 100, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
        expect(Math.abs(circuit.lastResults.viewMap.get('D1')?.currentValue || 0)).toBeGreaterThan(50);
    });

    it('starts a 500 Hz min-Ron mixed Diode+LED bridge after capacitor-first restore', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 500 });
        const d1 = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);

        const history = new HistoryManager({ circuit, updateStatus() {}, logger: { error() {} } });
        history.runWithHistory('add dummy', () => {
            addComponent(circuit, 'Resistor', 'Rdummy', { resistance: 1e12 });
        });
        history.undo();
        expect(circuit.components.has('Rdummy')).toBe(false);
        expect([...circuit.components.keys()]).toEqual(['C', 'D1', 'D2', 'L3', 'L4', 'S']);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        expect(new RuntimeActionRouter({ circuit: restored }).startSimulation()).toBe(true);
        restored.step();
        expect(restored.lastResults.valid).toBe(true);
        expect(restored.lastResults.backendUsed).toBe('v2');
        expect(restored.lastResults.meta?.converged).toBe(true);
    });

    it('starts the mixed bridge even with unused, dangling, open-switch, and pendant batteries on the canvas', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 500 });
        const d1 = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);
        addComponent(circuit, 'PowerSource', 'Vextra', { voltage: 48, internalResistance: 0.5 });
        const dangling = addComponent(circuit, 'PowerSource', 'Vdangle', { voltage: 48, internalResistance: 0.5 });
        connectWire(circuit, 'Wdangle', dangling, 0, cap, 0);
        const loopSource = addComponent(circuit, 'PowerSource', 'Vloop', { voltage: 48, internalResistance: 0.5 });
        const loopResistor = addComponent(circuit, 'Resistor', 'Rloop', { resistance: 100 });
        connectWire(circuit, 'Wloop1', loopSource, 0, loopResistor, 0);
        connectWire(circuit, 'Wloop2', loopResistor, 1, loopSource, 1);
        const openSwitch = addComponent(circuit, 'Switch', 'Kopen', { closed: false });
        connectWire(circuit, 'Wopen1', openSwitch, 0, cap, 0);
        connectWire(circuit, 'Wopen2', openSwitch, 1, loopSource, 0);
        const pendant = addComponent(circuit, 'PowerSource', 'Vpend', { voltage: 30, internalResistance: 0.5 });
        const pendantResistor = addComponent(circuit, 'Resistor', 'Rpend', { resistance: 100 });
        connectWire(circuit, 'Wpend1', pendant, 0, cap, 0);
        connectWire(circuit, 'Wpend2', pendant, 1, pendantResistor, 0);
        connectWire(circuit, 'Wpend3', pendantResistor, 1, cap, 0);
        const hanging = addComponent(circuit, 'PowerSource', 'Vhang', { voltage: 30, internalResistance: 0.5 });
        const hangingLoad = addComponent(circuit, 'Resistor', 'Rhang', { resistance: 100 });
        connectWire(circuit, 'Whang1', hanging, 0, cap, 0);
        connectWire(circuit, 'Whang2', hanging, 1, hangingLoad, 0);
        const net = addComponent(circuit, 'PowerSource', 'Vnet', { voltage: 48, internalResistance: 0.5 });
        const netR1 = addComponent(circuit, 'Resistor', 'Rnet1', { resistance: 100 });
        const netR2 = addComponent(circuit, 'Resistor', 'Rnet2', { resistance: 100 });
        connectWire(circuit, 'Wnet1', net, 0, cap, 0);
        connectWire(circuit, 'Wnet2', net, 1, netR1, 0);
        connectWire(circuit, 'Wnet3', netR1, 1, netR2, 0);
        connectWire(circuit, 'Wnet4', netR2, 1, cap, 0);
        const thLoop = addComponent(circuit, 'PowerSource', 'Vth', { voltage: 48, internalResistance: 0.5 });
        const thR = addComponent(circuit, 'Resistor', 'Rth', { resistance: 100 });
        const thermistor = addComponent(circuit, 'Thermistor', 'Tth', { resistanceAt25: 1e15 });
        connectWire(circuit, 'Wth1', thLoop, 0, thR, 0);
        connectWire(circuit, 'Wth2', thR, 1, thLoop, 1);
        connectWire(circuit, 'Wth3', thermistor, 0, cap, 0);
        connectWire(circuit, 'Wth4', thermistor, 1, thLoop, 0);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }

        const history = new HistoryManager({ circuit, updateStatus() {}, logger: { error() {} } });
        history.runWithHistory('add dummy', () => {
            addComponent(circuit, 'Resistor', 'Rdummy', { resistance: 1e12 });
        });
        history.undo();
        expect(circuit.components.has('Rdummy')).toBe(false);
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
    });

    it('starts a 24 V RMS parallel-AC mixed bridge for twenty walls', () => {
        const circuit = createTestCircuit();
        const source1 = addComponent(circuit, 'ACVoltageSource', 'S1', { rmsVoltage: 24, frequency: 1800 });
        const source2 = addComponent(circuit, 'ACVoltageSource', 'S2', { rmsVoltage: 24, frequency: 1800 });
        const d1 = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source1, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source1, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source1, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source1, 1);
        connectWire(circuit, 'W9', source2, 0, source1, 0);
        connectWire(circuit, 'W10', source2, 1, source1, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 20; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }
    });

    it('starts a relay-gated 500V diode capacitor after the coil pulls in', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 500, internalResistance: 0.5 });
        const coilBattery = addComponent(circuit, 'PowerSource', 'Vc', { voltage: 6, internalResistance: 0.5 });
        const relay = addComponent(circuit, 'Relay', 'K1', {});
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, relay, 2);
        connectWire(circuit, 'W2', relay, 3, diode, 0);
        connectWire(circuit, 'W3', diode, 1, source, 1);
        connectWire(circuit, 'W4', cap, 0, diode, 0);
        connectWire(circuit, 'W5', cap, 1, diode, 1);
        connectWire(circuit, 'W6', coilBattery, 0, relay, 0);
        connectWire(circuit, 'W7', coilBattery, 1, relay, 1);
        connectWire(circuit, 'W8', coilBattery, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 5; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }
    });

    it('starts a 60V battery, default diode, and default capacitor', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 60, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, cap, 0);
        connectWire(circuit, 'W3', cap, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a 500V AC offset, default diode, and default capacitor', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', {
            rmsVoltage: 0,
            offset: 500,
            frequency: 50
        });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, cap, 0);
        connectWire(circuit, 'W3', cap, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a 500V AC offset with default RMS, default diode, and default capacitor', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', {
            rmsVoltage: 12,
            offset: 500,
            frequency: 50
        });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, cap, 0);
        connectWire(circuit, 'W3', cap, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a 500V battery in parallel with a default diode and capacitor', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 500, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, source, 1);
        connectWire(circuit, 'W3', cap, 0, source, 0);
        connectWire(circuit, 'W4', cap, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts the mixed bridge with a 48V two-resistor loop on the AC live pin', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 500 });
        const d1 = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);
        const net = addComponent(circuit, 'PowerSource', 'Vnet', { voltage: 48, internalResistance: 0.5 });
        const netR1 = addComponent(circuit, 'Resistor', 'Rnet1', { resistance: 100 });
        const netR2 = addComponent(circuit, 'Resistor', 'Rnet2', { resistance: 100 });
        connectWire(circuit, 'Wnet1', net, 0, source, 0);
        connectWire(circuit, 'Wnet2', net, 1, netR1, 0);
        connectWire(circuit, 'Wnet3', netR1, 1, netR2, 0);
        connectWire(circuit, 'Wnet4', netR2, 1, source, 0);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }

        const history = new HistoryManager({ circuit, updateStatus() {}, logger: { error() {} } });
        history.runWithHistory('add dummy', () => {
            addComponent(circuit, 'Resistor', 'Rdummy', { resistance: 1e12 });
        });
        history.undo();
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
    });

    it('starts the mixed bridge after undo of a voltmeter-linked 48V loop', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 500 });
        const d1 = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);
        const net = addComponent(circuit, 'PowerSource', 'Vnet', { voltage: 48, internalResistance: 0.5 });
        const netR = addComponent(circuit, 'Resistor', 'Rnet', { resistance: 100 });
        const meter = addComponent(circuit, 'Voltmeter', 'VM', { resistance: 1e6 });
        connectWire(circuit, 'Wnet1', net, 0, netR, 0);
        connectWire(circuit, 'Wnet2', netR, 1, net, 1);
        connectWire(circuit, 'Wvm1', meter, 0, cap, 0);
        connectWire(circuit, 'Wvm2', meter, 1, net, 0);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);

        const history = new HistoryManager({ circuit, updateStatus() {}, logger: { error() {} } });
        history.runWithHistory('add dummy', () => {
            addComponent(circuit, 'Resistor', 'Rdummy', { resistance: 1e12 });
        });
        history.undo();
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
    });

    it.each([151, 160])('starts the mixed bridge after undo of a voltmeter-linked %sV loop', (voltage) => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 500 });
        const d1 = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);
        const net = addComponent(circuit, 'PowerSource', 'Vnet', { voltage, internalResistance: 0.5 });
        const netR = addComponent(circuit, 'Resistor', 'Rnet', { resistance: 100 });
        const meter = addComponent(circuit, 'Voltmeter', 'VM', { resistance: 1e6 });
        connectWire(circuit, 'Wnet1', net, 0, netR, 0);
        connectWire(circuit, 'Wnet2', netR, 1, net, 1);
        connectWire(circuit, 'Wvm1', meter, 0, cap, 0);
        connectWire(circuit, 'Wvm2', meter, 1, net, 0);

        const history = new HistoryManager({ circuit, updateStatus() {}, logger: { error() {} } });
        history.runWithHistory('add dummy', () => {
            addComponent(circuit, 'Resistor', 'Rdummy', { resistance: 1e12 });
        });
        history.undo();
        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }
    });

    it('starts a 500V half-wave rectifier with AC from the cathode through a grounded load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 500, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { rmsVoltage: 12, frequency: 50 });
        const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, diode, 0);
        connectWire(circuit, 'W2', diode, 1, cap, 0);
        connectWire(circuit, 'W3', cap, 1, source, 1);
        connectWire(circuit, 'W4', ac, 0, diode, 1);
        connectWire(circuit, 'W5', ac, 1, load, 0);
        connectWire(circuit, 'W6', load, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a 500V battery in series with AC through a 1 ohm resistor, diode, and capacitor', () => {
        const circuit = createTestCircuit();
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { frequency: 50 });
        const sep = addComponent(circuit, 'Resistor', 'R1', { resistance: 1 });
        const battery = addComponent(circuit, 'PowerSource', 'V1', { voltage: 500, internalResistance: 0.5 });
        const diode = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', ac, 0, sep, 0);
        connectWire(circuit, 'W2', sep, 1, battery, 1);
        connectWire(circuit, 'W3', battery, 0, diode, 0);
        connectWire(circuit, 'W4', diode, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, ac, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a mixed bridge with a 500V half-wave rectifier on the DC bus', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 500 });
        const d1 = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);
        const battery = addComponent(circuit, 'PowerSource', 'Vbus', { voltage: 500, internalResistance: 0.5 });
        const seriesDiode = addComponent(circuit, 'Diode', 'Ds', {});
        const busCap = addComponent(circuit, 'Capacitor', 'Cs', {});
        connectWire(circuit, 'W9', battery, 0, seriesDiode, 0);
        connectWire(circuit, 'W10', seriesDiode, 1, cap, 0);
        connectWire(circuit, 'W11', busCap, 0, cap, 0);
        connectWire(circuit, 'W12', busCap, 1, battery, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(250);
    });

    it('starts four series diodes with a 1 ohm separator, 10000V battery, capacitor, and AC load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10000, internalResistance: 0.5 });
        const sep = addComponent(circuit, 'Resistor', 'Rsep', { resistance: 1 });
        const d0 = addComponent(circuit, 'Diode', 'D0', {});
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const d3 = addComponent(circuit, 'Diode', 'D3', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { rmsVoltage: 12, frequency: 50 });
        const load = addComponent(circuit, 'Resistor', 'RL', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, sep, 0);
        connectWire(circuit, 'W2', sep, 1, d0, 0);
        connectWire(circuit, 'W3', d0, 1, d1, 0);
        connectWire(circuit, 'W4', d1, 1, d2, 0);
        connectWire(circuit, 'W5', d2, 1, d3, 0);
        connectWire(circuit, 'W6', d3, 1, cap, 0);
        connectWire(circuit, 'W7', cap, 1, source, 1);
        connectWire(circuit, 'W8', ac, 0, cap, 0);
        connectWire(circuit, 'W9', ac, 1, load, 0);
        connectWire(circuit, 'W10', load, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a mixed diode-LED series string with a 1 ohm separator, 500V battery, capacitor, and AC load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 500, internalResistance: 0.5 });
        const sep = addComponent(circuit, 'Resistor', 'Rsep', { resistance: 1 });
        const d0 = addComponent(circuit, 'Diode', 'D0', {});
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const l2 = addComponent(circuit, 'LED', 'L2', {});
        const l3 = addComponent(circuit, 'LED', 'L3', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { rmsVoltage: 12, frequency: 50 });
        const load = addComponent(circuit, 'Resistor', 'RL', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, sep, 0);
        connectWire(circuit, 'W2', sep, 1, d0, 0);
        connectWire(circuit, 'W3', d0, 1, d1, 0);
        connectWire(circuit, 'W4', d1, 1, l2, 0);
        connectWire(circuit, 'W5', l2, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, cap, 0);
        connectWire(circuit, 'W7', cap, 1, source, 1);
        connectWire(circuit, 'W8', ac, 0, cap, 0);
        connectWire(circuit, 'W9', ac, 1, load, 0);
        connectWire(circuit, 'W10', load, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts two parallel diodes with a 1 ohm separator, 10000V battery, capacitor, and AC load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10000, internalResistance: 0.5 });
        const sep = addComponent(circuit, 'Resistor', 'Rsep', { resistance: 1 });
        const d0 = addComponent(circuit, 'Diode', 'D0', {});
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { rmsVoltage: 12, frequency: 50 });
        const load = addComponent(circuit, 'Resistor', 'RL', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, sep, 0);
        connectWire(circuit, 'W2', sep, 1, d0, 0);
        connectWire(circuit, 'W3', d0, 1, cap, 0);
        connectWire(circuit, 'W4', sep, 1, d1, 0);
        connectWire(circuit, 'W5', d1, 1, cap, 0);
        connectWire(circuit, 'W6', cap, 1, source, 1);
        connectWire(circuit, 'W7', ac, 0, cap, 0);
        connectWire(circuit, 'W8', ac, 1, load, 0);
        connectWire(circuit, 'W9', load, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a diode triangle with AC across one edge, 10000V battery, capacitor, and load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10000, internalResistance: 0.5 });
        const sep = addComponent(circuit, 'Resistor', 'Rsep', { resistance: 1 });
        const d0 = addComponent(circuit, 'Diode', 'D0', {});
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { rmsVoltage: 12, frequency: 50 });
        const load = addComponent(circuit, 'Resistor', 'RL', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, sep, 0);
        connectWire(circuit, 'W2', sep, 1, d0, 0);
        connectWire(circuit, 'W3', d0, 1, d1, 0);
        connectWire(circuit, 'W4', d1, 1, d2, 0);
        connectWire(circuit, 'W5', d2, 1, d0, 0);
        connectWire(circuit, 'W6', cap, 0, d1, 1);
        connectWire(circuit, 'W7', cap, 1, source, 1);
        connectWire(circuit, 'W8', ac, 0, d0, 0);
        connectWire(circuit, 'W9', ac, 1, d1, 1);
        connectWire(circuit, 'W10', load, 0, d1, 1);
        connectWire(circuit, 'W11', load, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a diode pentagon with AC across a 2-hop chord, 10000V battery, capacitor, and load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10000, internalResistance: 0.5 });
        const sep = addComponent(circuit, 'Resistor', 'Rsep', { resistance: 1 });
        const d0 = addComponent(circuit, 'Diode', 'D0', {});
        const d1 = addComponent(circuit, 'Diode', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const d3 = addComponent(circuit, 'Diode', 'D3', {});
        const d4 = addComponent(circuit, 'Diode', 'D4', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { rmsVoltage: 12, frequency: 50 });
        const load = addComponent(circuit, 'Resistor', 'RL', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, sep, 0);
        connectWire(circuit, 'W2', sep, 1, d0, 0);
        connectWire(circuit, 'W3', d0, 1, d1, 0);
        connectWire(circuit, 'W4', d1, 1, d2, 0);
        connectWire(circuit, 'W5', d2, 1, d3, 0);
        connectWire(circuit, 'W6', d3, 1, d4, 0);
        connectWire(circuit, 'W7', d4, 1, d0, 0);
        connectWire(circuit, 'W8', cap, 0, d3, 1);
        connectWire(circuit, 'W9', cap, 1, source, 1);
        connectWire(circuit, 'W10', ac, 0, d0, 0);
        connectWire(circuit, 'W11', ac, 1, d1, 1);
        connectWire(circuit, 'W12', load, 0, d1, 1);
        connectWire(circuit, 'W13', load, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a mixed diode-LED diamond with AC on the diagonal, 10000V battery, capacitor, and load', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10000, internalResistance: 0.5 });
        const sep = addComponent(circuit, 'Resistor', 'Rsep', { resistance: 1 });
        const d0 = addComponent(circuit, 'Diode', 'D0', {});
        const d1 = addComponent(circuit, 'LED', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const d3 = addComponent(circuit, 'LED', 'D3', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { rmsVoltage: 12, frequency: 50 });
        const load = addComponent(circuit, 'Resistor', 'RL', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, sep, 0);
        connectWire(circuit, 'W2', sep, 1, d0, 0);
        connectWire(circuit, 'W3', d0, 1, d1, 0);
        connectWire(circuit, 'W4', d1, 1, cap, 0);
        connectWire(circuit, 'W5', d0, 0, d2, 0);
        connectWire(circuit, 'W6', d2, 1, d3, 0);
        connectWire(circuit, 'W7', d3, 1, cap, 0);
        connectWire(circuit, 'W8', cap, 1, source, 1);
        connectWire(circuit, 'W9', ac, 0, d0, 0);
        connectWire(circuit, 'W10', ac, 1, cap, 0);
        connectWire(circuit, 'W11', load, 0, cap, 0);
        connectWire(circuit, 'W12', load, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('starts a mixed diamond with the capacitor across the injection edge at 10000V', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 10000, internalResistance: 0.5 });
        const sep = addComponent(circuit, 'Resistor', 'Rsep', { resistance: 1 });
        const d0 = addComponent(circuit, 'Diode', 'D0', {});
        const d1 = addComponent(circuit, 'LED', 'D1', {});
        const d2 = addComponent(circuit, 'Diode', 'D2', {});
        const d3 = addComponent(circuit, 'LED', 'D3', {});
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        const ac = addComponent(circuit, 'ACVoltageSource', 'A1', { rmsVoltage: 12, frequency: 50 });
        const load = addComponent(circuit, 'Resistor', 'RL', { resistance: 100 });
        connectWire(circuit, 'W1', source, 0, sep, 0);
        connectWire(circuit, 'W2', sep, 1, d0, 0);
        connectWire(circuit, 'W3', d0, 1, d1, 0);
        connectWire(circuit, 'W4', d1, 1, d3, 1);
        connectWire(circuit, 'W5', d0, 0, d2, 0);
        connectWire(circuit, 'W6', d2, 1, d3, 0);
        connectWire(circuit, 'W7', cap, 0, d0, 0);
        connectWire(circuit, 'W8', cap, 1, d2, 1);
        connectWire(circuit, 'W9', d1, 1, source, 1);
        connectWire(circuit, 'W10', ac, 0, d0, 0);
        connectWire(circuit, 'W11', ac, 1, d1, 1);
        connectWire(circuit, 'W12', load, 0, d1, 1);
        connectWire(circuit, 'W13', load, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        circuit.step();
        expect(circuit.lastResults.valid).toBe(true);
        expect(circuit.lastResults.backendUsed).toBe('v2');
        expect(circuit.lastResults.meta?.converged).toBe(true);
        expect(circuit.lastResults.meta?.iterations).toBeLessThan(80);
    });

    it('settles a steep idealityFactor diode with series R in a few Newton iterations', () => {
        const result = solveCircuitV2({
            meta: { version: 2 },
            nodes: [{ id: '0' }, { id: '1' }, { id: '2' }],
            components: [
                {
                    id: 'V1',
                    type: 'PowerSource',
                    nodes: [1, 0],
                    params: { voltage: 12, internalResistance: 0 }
                },
                {
                    id: 'D1',
                    type: 'Diode',
                    nodes: [1, 2],
                    params: { idealityFactor: 1e-12, forwardVoltage: 0.7, onResistance: 1 }
                },
                {
                    id: 'R1',
                    type: 'Resistor',
                    nodes: [2, 0],
                    params: { resistance: 100 }
                }
            ]
        }, new SimulationStateV2(), { dt: 0.01 });

        expect(result.valid).toBe(true);
        expect(result.meta?.converged).toBe(true);
        expect(result.meta?.iterations).toBeLessThan(10);
        expect(result.currents.get('D1')).toBeCloseTo(12 / 101, 3);
    });

    it('starts an 1800 Hz min-Ron LED-Diode-LED-Diode bridge', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S', { frequency: 1800 });
        const d1 = addComponent(circuit, 'LED', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'Diode', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 10; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }
    });

    it('starts an 1800 Hz min-Ron mixed bridge with a second 22 V RMS AC source', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'ACVoltageSource', 'S1', { frequency: 1800, rmsVoltage: 22 });
        const source2 = addComponent(circuit, 'ACVoltageSource', 'S2', { frequency: 1800, rmsVoltage: 22 });
        const d1 = addComponent(circuit, 'Diode', 'D1', { onResistance: 1e-9 });
        const d2 = addComponent(circuit, 'Diode', 'D2', { onResistance: 1e-9 });
        const l3 = addComponent(circuit, 'LED', 'L3', { onResistance: 1e-9 });
        const l4 = addComponent(circuit, 'LED', 'L4', { onResistance: 1e-9 });
        const cap = addComponent(circuit, 'Capacitor', 'C', {});
        connectWire(circuit, 'W1', source, 0, d1, 0);
        connectWire(circuit, 'W2', d1, 1, cap, 0);
        connectWire(circuit, 'W3', source, 1, d2, 0);
        connectWire(circuit, 'W4', d2, 1, cap, 0);
        connectWire(circuit, 'W5', cap, 1, l3, 0);
        connectWire(circuit, 'W6', l3, 1, source, 0);
        connectWire(circuit, 'W7', cap, 1, l4, 0);
        connectWire(circuit, 'W8', l4, 1, source, 1);
        connectWire(circuit, 'W9', source2, 0, source, 0);
        connectWire(circuit, 'W10', source2, 1, source, 1);

        expect(new RuntimeActionRouter({ circuit }).startSimulation()).toBe(true);
        for (let i = 0; i < 20; i += 1) {
            circuit.step();
            expect(circuit.lastResults.valid).toBe(true);
            expect(circuit.lastResults.backendUsed).toBe('v2');
            expect(circuit.lastResults.meta?.converged).toBe(true);
        }
    });
});
