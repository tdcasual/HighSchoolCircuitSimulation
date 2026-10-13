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
});
