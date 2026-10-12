import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyViewMapToComponents } from '../src/app/simulation/ComponentViewAdapter.js';
import { addComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

const ADAPTER_PATH = resolve(process.cwd(), 'src/app/simulation/ComponentViewAdapter.js');

describe('ComponentViewAdapter', () => {
    it('documents sunset conditions and forbids copying topology fields', () => {
        const source = readFileSync(ADAPTER_PATH, 'utf8');
        expect(source).toContain('Renderer.setViewMap');
        expect(source).toContain('buildValueDisplaySnapshot prefers ViewMap');
        expect(source).toContain('MeasurementReadoutController');
        expect(source).toContain('PropertyPanelController');
        expect(source).toContain('ObservationSources');
        expect(source).toContain('ObservationExportService');
        expect(source).toContain('two release cycles');
        expect(source).toContain('Never delete the adapter before Renderer reads ViewMap');
        expect(source).toContain('禁止: comp.nodes = ...; wire.nodeIndex = ...; circuit.nodes = ...');
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gmu, '');
        expect(code).not.toMatch(/comp\.nodes\s*=/);
        expect(code).not.toMatch(/wire\.nodeIndex\s*=/);
        expect(code).not.toMatch(/circuit\.nodes\s*=/);
        expect(code).not.toMatch(/SolveCircuitV2|runSimulationStepV2/);
    });

    it('copies display fields including real zeros and leaves topology untouched', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', { voltage: 3, internalResistance: 2 });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 8 });
        const led = addComponent(circuit, 'LED', 'LED1', { ratedCurrent: 0.02 });
        const wire = connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        resistor.nodes = [1, 0];
        resistor.currentValue = 9;
        resistor.voltageValue = 9;
        resistor.powerValue = 9;
        resistor.voltageSegLeft = 1;
        led.currentValue = 9;
        led.voltageValue = 9;
        led.powerValue = 9;
        led.brightness = 1;
        led.conducting = true;
        wire.nodeIndex = 4;
        const circuitNodes = circuit.nodes;
        const liveResistorNodes = resistor.nodes;

        const viewMap = new Map([
            ['R1', {
                currentValue: 0,
                voltageValue: 0,
                powerValue: 0,
                voltageSegLeft: 9,
                voltageSegRight: 0,
                nodes: [9, 8],
                status: 'ok'
            }],
            ['LED1', {
                currentValue: 0.01,
                voltageValue: 2,
                powerValue: 0.02,
                brightness: 0,
                conducting: false,
                status: 'ok'
            }],
            ['missing', {
                currentValue: 1,
                voltageValue: 1,
                powerValue: 1,
                status: 'ok'
            }]
        ]);

        applyViewMapToComponents(circuit, viewMap);

        expect(resistor.currentValue).toBe(0);
        expect(resistor.voltageValue).toBe(0);
        expect(resistor.powerValue).toBe(0);
        expect(resistor.voltageSegLeft).toBe(9);
        expect(resistor.voltageSegRight).toBe(0);
        expect(resistor.status).toBeUndefined();
        expect(resistor.nodes).toBe(liveResistorNodes);
        expect(resistor.nodes).toEqual([1, 0]);
        expect(led.brightness).toBe(0);
        expect(led.conducting).toBe(false);
        expect(wire.nodeIndex).toBe(4);
        expect(circuit.nodes).toBe(circuitNodes);
        expect(circuit.components.has('missing')).toBe(false);
    });
});
