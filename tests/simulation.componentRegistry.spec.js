import { describe, expect, it } from 'vitest';
import { ComponentRegistry, DefaultComponentRegistry } from '../src/core/simulation/ComponentRegistry.js';
import { ComponentDefaults } from '../src/components/Component.js';
import { computeNtcThermistorResistance, computePhotoresistorResistance } from '../src/utils/Physics.js';
import { evaluateJunctionCurrent, linearizeJunctionAt, resolveJunctionParameters } from '../src/core/simulation/JunctionModel.js';

describe('ComponentRegistry', () => {
    it('returns handlers for known types', () => {
        const registry = new ComponentRegistry();
        registry.register('Resistor', { stamp: () => 'ok' });
        expect(registry.get('Resistor').stamp()).toBe('ok');
        expect(registry.get('Unknown')).toBe(null);
    });

    it('covers all ComponentDefaults types with stamp/current handlers in default registry', () => {
        const supportedTypes = Object.keys(ComponentDefaults);
        const missing = [];

        for (const type of supportedTypes) {
            const handler = DefaultComponentRegistry.get(type);
            if (!handler || typeof handler.stamp !== 'function' || typeof handler.current !== 'function') {
                missing.push(type);
            }
        }

        expect(missing).toEqual([]);
    });

    it('stamps resistor via registry', () => {
        const handler = DefaultComponentRegistry.get('Resistor');
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r })
        };

        handler.stamp({ resistance: 100 }, context, { i1: 0, i2: 1 });
        expect(calls).toEqual([{ i1: 0, i2: 1, r: 100 }]);
    });

    it('covers day3 target component types with stamp/current handlers', () => {
        const targetTypes = ['Thermistor', 'Photoresistor', 'Ammeter', 'Voltmeter'];

        for (const type of targetTypes) {
            expect(ComponentDefaults[type]).toBeTruthy();
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('stamps thermistor/photoresistor using computed resistance models', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r })
        };

        const thermistor = { ...ComponentDefaults.Thermistor, id: 'RT1' };
        const photoresistor = { ...ComponentDefaults.Photoresistor, id: 'LDR1' };

        DefaultComponentRegistry.get('Thermistor').stamp(thermistor, context, { i1: 2, i2: 3 });
        DefaultComponentRegistry.get('Photoresistor').stamp(photoresistor, context, { i1: 4, i2: 5 });

        expect(calls[0]).toEqual({
            i1: 2,
            i2: 3,
            r: computeNtcThermistorResistance(thermistor)
        });
        expect(calls[1]).toEqual({
            i1: 4,
            i2: 5,
            r: computePhotoresistorResistance(photoresistor)
        });
    });

    it('covers day9 target component types with stamp/current handlers', () => {
        const targetTypes = ['Switch', 'SPDTSwitch', 'Fuse'];

        for (const type of targetTypes) {
            expect(ComponentDefaults[type]).toBeTruthy();
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('uses switch and fuse registry stamp/current behaviors equivalent to solver logic', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r }),
            voltage: (nodeIdx) => ({ 1: 5, 2: 1 }[nodeIdx] || 0)
        };

        const switchHandler = DefaultComponentRegistry.get('Switch');
        switchHandler.stamp({ closed: true }, context, { i1: 0, i2: 1 });
        switchHandler.stamp({ closed: false }, context, { i1: 0, i2: 1 });
        expect(calls[0]).toEqual({ i1: 0, i2: 1, r: 1e-9 });
        expect(calls[1]).toEqual({ i1: 0, i2: 1, r: 1e12 });
        expect(switchHandler.current({ closed: true }, context, { n1: 1, n2: 2 })).toBeCloseTo(4e9, 0);
        expect(switchHandler.current({ closed: false }, context, { n1: 1, n2: 2 })).toBe(0);

        const fuseHandler = DefaultComponentRegistry.get('Fuse');
        fuseHandler.stamp({ blown: false, coldResistance: 0.05 }, context, { i1: 2, i2: 3 });
        fuseHandler.stamp({ blown: true, blownResistance: 1e12 }, context, { i1: 2, i2: 3 });
        expect(calls[2]).toEqual({ i1: 2, i2: 3, r: 0.05 });
        expect(calls[3]).toEqual({ i1: 2, i2: 3, r: 1e12 });
        expect(fuseHandler.current({ blown: false, coldResistance: 2 }, context, { n1: 1, n2: 2 })).toBeCloseTo(2, 9);
    });

    it('routes spdt switch stamps and current through selected throw', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r }),
            voltage: (nodeIdx) => ({ 1: 10, 2: 6, 3: 2 }[nodeIdx] || 0)
        };
        const handler = DefaultComponentRegistry.get('SPDTSwitch');
        const comp = {
            nodes: [1, 2, 3],
            position: 'a',
            onResistance: 2,
            offResistance: 10
        };
        const nodes = {
            n1: 1,
            isValidNode: (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0
        };

        handler.stamp(comp, context, nodes);
        expect(calls).toEqual([
            { i1: 0, i2: 1, r: 2 },
            { i1: 0, i2: 2, r: 10 }
        ]);
        expect(handler.current(comp, context, nodes)).toBeCloseTo(2, 9);

        comp.position = 'b';
        expect(handler.current(comp, context, nodes)).toBeCloseTo(4, 9);
    });

    it('covers day9 relay/rheostat target types with stamp/current handlers', () => {
        const targetTypes = ['Relay', 'Rheostat'];
        for (const type of targetTypes) {
            expect(ComponentDefaults[type]).toBeTruthy();
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('uses relay and rheostat registry stamp/current behaviors equivalent to solver logic', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r }),
            voltage: (nodeIdx) => ({ 1: 12, 2: 2, 3: 9, 4: 1, 5: 8 }[nodeIdx] || 0)
        };
        const relayHandler = DefaultComponentRegistry.get('Relay');
        relayHandler.stamp({
            nodes: [1, 2, 3, 4],
            coilResistance: 200,
            contactOnResistance: 0.001,
            contactOffResistance: 1e12,
            energized: true
        }, context, {
            isValidNode: (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0
        });
        expect(calls[0]).toEqual({ i1: 0, i2: 1, r: 200 });
        expect(calls[1]).toEqual({ i1: 2, i2: 3, r: 0.001 });
        expect(relayHandler.current({
            nodes: [1, 2],
            coilResistance: 200
        }, context, { n1: 1, n2: 2 })).toBeCloseTo(0.05, 9);

        const rheostatHandler = DefaultComponentRegistry.get('Rheostat');
        rheostatHandler.stamp({
            nodes: [1, 2, 5],
            minResistance: 0,
            maxResistance: 100,
            position: 0.25,
            connectionMode: 'left-slider'
        }, context, {
            isValidNode: (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0
        });
        expect(calls[2]).toEqual({ i1: 0, i2: 4, r: 25 });
        expect(rheostatHandler.current({
            nodes: [1, 2, 5],
            minResistance: 0,
            maxResistance: 100,
            position: 0.25,
            connectionMode: 'left-slider'
        }, context)).toBeCloseTo(0.16, 9);
    });

    it('covers day10 diode/led target types with stamp/current handlers', () => {
        const targetTypes = ['Diode', 'LED'];
        for (const type of targetTypes) {
            expect(ComponentDefaults[type]).toBeTruthy();
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('uses diode registry stamp/current behaviors equivalent to solver and postprocessor logic', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ kind: 'R', i1, i2, r }),
            stampCurrentSource: (from, to, current) => calls.push({ kind: 'I', from, to, current }),
            voltage: (nodeIdx) => ({ 1: 0.75, 2: 0 }[nodeIdx] || 0),
            state: {
                junctionVoltage: 0.71,
                junctionCurrent: 0.002
            }
        };
        const nodes = { i1: 0, i2: 1, n1: 1, n2: 2 };
        const comp = {
            id: 'D1',
            type: 'Diode',
            forwardVoltage: 0.7,
            onResistance: 1,
            idealityFactor: 1.8,
            referenceCurrent: 0.001
        };
        const handler = DefaultComponentRegistry.get('Diode');
        const params = resolveJunctionParameters(comp);
        const expectedLinearized = linearizeJunctionAt(
            context.state.junctionVoltage,
            params,
            context.state.junctionCurrent
        );

        handler.stamp(comp, context, nodes);
        expect(calls[0].kind).toBe('R');
        expect(calls[0].i1).toBe(0);
        expect(calls[0].i2).toBe(1);
        expect(calls[0].r).toBeCloseTo(1 / Math.max(1e-12, expectedLinearized.conductance), 12);
        expect(calls[1]).toEqual({
            kind: 'I',
            from: 0,
            to: 1,
            current: expectedLinearized.currentOffset
        });

        const expectedCurrent = evaluateJunctionCurrent(
            context.voltage(1) - context.voltage(2),
            params,
            context.state.junctionCurrent
        );
        expect(handler.current(comp, context, nodes)).toBeCloseTo(expectedCurrent, 12);
    });

    it('covers day11 motor target type with stamp/current handlers', () => {
        const handler = DefaultComponentRegistry.get('Motor');
        expect(ComponentDefaults.Motor).toBeTruthy();
        expect(handler, 'Motor should be registered').toBeTruthy();
        expect(typeof handler.stamp, 'Motor should provide stamp()').toBe('function');
        expect(typeof handler.current, 'Motor should provide current()').toBe('function');
    });

    it('uses motor registry stamp/current behaviors equivalent to solver and postprocessor logic', () => {
        const calls = [];
        const handler = DefaultComponentRegistry.get('Motor');
        const comp = {
            type: 'Motor',
            resistance: 5,
            backEmf: 2.5,
            vsIndex: 1
        };
        const nodes = { i1: 0, i2: 1, nodeCount: 4, n1: 1, n2: 2 };
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ kind: 'R', i1, i2, r }),
            stampVoltageSource: (i1, i2, voltage, vsIndex, nodeCount) => calls.push({
                kind: 'V',
                i1,
                i2,
                voltage,
                vsIndex,
                nodeCount
            }),
            solveVector: [0, 0, 0, 0, 0.3]
        };

        handler.stamp(comp, context, nodes);
        expect(calls[0]).toEqual({ kind: 'R', i1: 0, i2: 1, r: 5 });
        expect(calls[1]).toEqual({
            kind: 'V',
            i1: 0,
            i2: 1,
            voltage: -2.5,
            vsIndex: 1,
            nodeCount: 4
        });

        expect(handler.current(comp, { ...context, nodeCount: 4 }, nodes)).toBeCloseTo(-0.3, 12);
    });

    it('covers day12 special target types with stamp/current handlers', () => {
        const targetTypes = ['Ground', 'BlackBox'];
        for (const type of targetTypes) {
            expect(ComponentDefaults[type]).toBeTruthy();
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('uses ground and blackbox registry behaviors as no-op current=0', () => {
        const calls = [];
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ i1, i2, r }),
            voltage: () => 10
        };
        const nodes = { i1: 0, i2: 1, n1: 1, n2: 2 };
        const groundHandler = DefaultComponentRegistry.get('Ground');
        const blackBoxHandler = DefaultComponentRegistry.get('BlackBox');

        groundHandler.stamp({ type: 'Ground' }, context, nodes);
        blackBoxHandler.stamp({ type: 'BlackBox' }, context, nodes);
        expect(calls).toEqual([]);
        expect(groundHandler.current({ type: 'Ground' }, context, nodes)).toBe(0);
        expect(blackBoxHandler.current({ type: 'BlackBox' }, context, nodes)).toBe(0);
    });

    it('covers day9 source target types with stamp/current handlers', () => {
        const targetTypes = ['PowerSource', 'ACVoltageSource'];
        for (const type of targetTypes) {
            expect(ComponentDefaults[type]).toBeTruthy();
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('stamps sources with norton-or-ideal branches equivalent to solver behavior', () => {
        const calls = [];
        const handler = DefaultComponentRegistry.get('PowerSource');
        const context = {
            stampResistor: (i1, i2, r) => calls.push({ kind: 'R', i1, i2, r }),
            stampCurrentSource: (from, to, current) => calls.push({ kind: 'I', from, to, current }),
            stampVoltageSource: (i1, i2, voltage, vsIndex, nodeCount) => calls.push({
                kind: 'V',
                i1,
                i2,
                voltage,
                vsIndex,
                nodeCount
            }),
            getSourceInstantVoltage: (comp) => comp._v || 0
        };

        const nodes = { i1: 0, i2: 1, nodeCount: 3, n1: 1, n2: 2 };
        handler.stamp({
            type: 'PowerSource',
            internalResistance: 2,
            _nortonModel: true,
            _v: 10
        }, context, nodes);
        expect(calls[0]).toEqual({ kind: 'R', i1: 0, i2: 1, r: 2 });
        expect(calls[1]).toEqual({ kind: 'I', from: 1, to: 0, current: 5 });

        handler.stamp({
            type: 'PowerSource',
            internalResistance: 0,
            _nortonModel: false,
            _v: 3,
            vsIndex: 1
        }, context, nodes);
        expect(calls[2]).toEqual({
            kind: 'V',
            i1: 0,
            i2: 1,
            voltage: 3,
            vsIndex: 1,
            nodeCount: 3
        });
    });

    it('covers dynamic component current handlers for registry-first path', () => {
        const targetTypes = ['Capacitor', 'ParallelPlateCapacitor', 'Inductor'];
        for (const type of targetTypes) {
            const handler = DefaultComponentRegistry.get(type);
            expect(handler, `${type} should be registered`).toBeTruthy();
            expect(typeof handler.stamp, `${type} should provide stamp()`).toBe('function');
            expect(typeof handler.current, `${type} should provide current()`).toBe('function');
        }
    });

    it('computes capacitor/inductor current in registry with backward-euler and trapezoidal methods', () => {
        const voltage = (nodeIdx) => ({ 1: 8, 2: 0 }[nodeIdx] || 0);
        const capacitorHandler = DefaultComponentRegistry.get('Capacitor');
        const inductorHandler = DefaultComponentRegistry.get('Inductor');
        const nodes = { n1: 1, n2: 2 };

        const capacitorBE = capacitorHandler.current({
            capacitance: 1,
            prevCharge: 0.2
        }, {
            voltage,
            dt: 0.1,
            state: { prevCharge: 0.2 },
            resolveDynamicIntegrationMethod: () => 'backward-euler'
        }, nodes);
        // qNew = C * dV = 8, dQ = 8 - 0.2 = 7.8, I = dQ/dt = 78
        expect(capacitorBE).toBeCloseTo(78, 9);

        const capacitorTrap = capacitorHandler.current({
            capacitance: 1,
            prevVoltage: 1,
            prevCurrent: 2
        }, {
            voltage,
            dt: 0.1,
            state: { prevVoltage: 1, prevCurrent: 2 },
            resolveDynamicIntegrationMethod: () => 'trapezoidal'
        }, nodes);
        // Req=0.05, Ieq=-(1/0.05+2)=-22, I=dV/Req+Ieq=160-22=138
        expect(capacitorTrap).toBeCloseTo(138, 9);

        const inductorBE = inductorHandler.current({
            inductance: 2,
            prevCurrent: 0.5
        }, {
            voltage,
            dt: 0.1,
            state: { prevCurrent: 0.5 },
            resolveDynamicIntegrationMethod: () => 'backward-euler'
        }, nodes);
        // I = prev + (dt/L)*dV = 0.5 + 0.1/2*8 = 0.9
        expect(inductorBE).toBeCloseTo(0.9, 9);

        const inductorTrap = inductorHandler.current({
            inductance: 2,
            prevCurrent: 0.5,
            prevVoltage: 4
        }, {
            voltage,
            dt: 0.1,
            state: { prevCurrent: 0.5, prevVoltage: 4 },
            resolveDynamicIntegrationMethod: () => 'trapezoidal'
        }, nodes);
        // Req=40, Ieq=0.5+4/40=0.6, I=8/40+0.6=0.8
        expect(inductorTrap).toBeCloseTo(0.8, 9);
    });
});
