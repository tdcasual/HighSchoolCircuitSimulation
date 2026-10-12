import { describe, expect, it } from 'vitest';
import { projectResultV2 } from '../src/v2/app/ResultProjector.js';
import { CircuitModel } from '../src/v2/domain/CircuitModel.js';
import { addComponent } from '../src/v2/domain/CircuitModelCommands.js';
import { getTerminalWorldPosition } from '../src/utils/TerminalGeometry.js';
import { SimulationStateV2 } from '../src/v2/simulation/SimulationStateV2.js';
import { snapshotCircuitModel } from '../src/v2/simulation/snapshotCircuitModel.js';
import { runSimulationStepV2 } from '../src/v2/app/usecases/RunSimulationStepV2.js';
import { addComponent as addLiveComponent, connectWire, createTestCircuit } from './helpers/circuitTestUtils.js';

function expectNoNodesOnView(view) {
    expect(view).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(view, 'nodes')).toBe(false);
}

describe('ResultProjector v2', () => {
    it('projects solve result into readonly component view models', () => {
        let model = CircuitModel.empty();
        model = addComponent(model, {
            id: 'V1',
            type: 'PowerSource',
            nodes: [1, 0],
            voltage: 3,
            internalResistance: 2
        });
        model = addComponent(model, {
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 8
        });

        const solveResult = {
            valid: true,
            voltages: [0, 2.4],
            currents: new Map([
                ['V1', -0.3],
                ['R1', 0.3]
            ]),
            diagnostics: { code: '', warnings: [] }
        };

        const netlist = {
            components: [
                { id: 'V1', type: 'PowerSource', nodes: [1, 0], params: {} },
                { id: 'R1', type: 'Resistor', nodes: [1, 0], params: {} }
            ]
        };

        const viewModel = projectResultV2({
            netlist,
            circuitModel: model,
            solveResult
        });

        expect(viewModel.valid).toBe(true);
        expect(viewModel.components).toHaveLength(2);
        expect(viewModel.viewMap).toBeInstanceOf(Map);
        const resistorVM = viewModel.components.find((item) => item.id === 'R1');
        expect(resistorVM.status).toBe('ok');
        expect(resistorVM.measurements.voltage).toBeCloseTo(2.4, 6);
        expect(resistorVM.measurements.current).toBeCloseTo(0.3, 6);
        expect(resistorVM.measurements.power).toBeCloseTo(0.72, 6);
        const resistorView = viewModel.viewMap.get('R1');
        expect(resistorView.voltageValue).toBeCloseTo(2.4, 6);
        expect(resistorView.currentValue).toBeCloseTo(0.3, 6);
        expect(resistorView.powerValue).toBeCloseTo(0.72, 6);
        expectNoNodesOnView(resistorView);

        const sourceView = viewModel.viewMap.get('V1');
        expect(sourceView.voltageValue).toBeCloseTo(2.4, 6);
        expect(sourceView.currentValue).toBeCloseTo(-0.3, 6);
        expect(sourceView.powerValue).toBeCloseTo(0.72, 6);
        expect(sourceView.powerValue).not.toBeCloseTo(sourceView.voltageValue * sourceView.currentValue, 6);

        const originalResistor = model.getComponent('R1');
        expect(originalResistor.display).toBeUndefined();
        expect(originalResistor.measurements).toBeUndefined();
    });

    it('marks disconnected component when current is missing from solve result', () => {
        let model = CircuitModel.empty();
        model = addComponent(model, {
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 8
        });

        const viewModel = projectResultV2({
            netlist: {
                components: [{ id: 'R1', type: 'Resistor', nodes: [1, 0], params: {} }]
            },
            circuitModel: model,
            solveResult: {
                valid: true,
                voltages: [0, 2.4],
                currents: new Map(),
                diagnostics: { code: '', warnings: [] }
            }
        });

        expect(viewModel.components[0].status).toBe('disconnected');
        expect(viewModel.components[0].measurements.current).toBe(0);
        expect(viewModel.components[0].measurements.voltage).toBe(0);
        expect(viewModel.components[0].measurements.power).toBe(0);
        const view = viewModel.viewMap.get('R1');
        expect(view.currentValue).toBe(0);
        expect(view.voltageValue).toBe(0);
        expect(view.powerValue).toBe(0);
        expect(view.status).toBe('disconnected');
        expectNoNodesOnView(view);
    });

    it('coerces non-finite current readings to zero in projection output', () => {
        let model = CircuitModel.empty();
        model = addComponent(model, {
            id: 'R1',
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 8
        });

        const viewModel = projectResultV2({
            netlist: {
                components: [{ id: 'R1', type: 'Resistor', nodes: [1, 0], params: {} }]
            },
            circuitModel: model,
            solveResult: {
                valid: true,
                voltages: [0, 2.4],
                currents: { R1: 'not-a-number' },
                diagnostics: { code: '', warnings: [] }
            }
        });

        expect(viewModel.components[0].measurements.current).toBe(0);
        expect(viewModel.components[0].measurements.power).toBe(0);
    });

    it('normalizes numeric current-map keys to component string ids', () => {
        let model = CircuitModel.empty();
        model = addComponent(model, {
            id: 0,
            type: 'Resistor',
            nodes: [1, 0],
            resistance: 8
        });

        const viewModel = projectResultV2({
            netlist: {
                components: [{ id: '0', type: 'Resistor', nodes: [1, 0], params: {} }]
            },
            circuitModel: model,
            solveResult: {
                valid: true,
                voltages: [0, 2.4],
                currents: new Map([[0, 0.3]]),
                diagnostics: { code: '', warnings: [] }
            }
        });

        expect(viewModel.components[0].id).toBe('0');
        expect(viewModel.components[0].status).toBe('ok');
        expect(viewModel.components[0].measurements.current).toBeCloseTo(0.3, 12);
    });

    it('reads terminal voltages from netlist nodes, not circuitModel.nodes', () => {
        let model = CircuitModel.empty();
        model = addComponent(model, {
            id: 'R1',
            type: 'Resistor',
            nodes: [9, 8],
            resistance: 8
        });

        const viewModel = projectResultV2({
            netlist: {
                components: [{ id: 'R1', type: 'Resistor', nodes: [1, 0], params: {} }]
            },
            circuitModel: model,
            solveResult: {
                valid: true,
                voltages: [0, 2.4],
                currents: new Map([['R1', 0.3]]),
                diagnostics: { code: '', warnings: [] }
            }
        });

        expect(viewModel.components[0].measurements.voltage).toBeCloseTo(2.4, 6);

        const ignoredModelNodes = projectResultV2({
            circuitModel: model,
            solveResult: {
                valid: true,
                voltages: [0, 2.4],
                currents: new Map([['R1', 0.3]]),
                diagnostics: { code: '', warnings: [] }
            }
        });
        expect(ignoredModelNodes.components[0].measurements.voltage).toBe(0);
        expect(ignoredModelNodes.viewMap.get('R1').currentValue).toBe(0);
    });

    it('uses absolute terminal voltage so reversed nodes do not keep a signed measurement', () => {
        const viewModel = projectResultV2({
            netlist: {
                components: [{ id: 'R1', type: 'Resistor', nodes: [0, 1], params: {} }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 2.4],
                currents: new Map([['R1', 0.3]])
            }
        });
        expect(viewModel.viewMap.get('R1').voltageValue).toBeCloseTo(2.4, 6);
        expect(viewModel.components[0].measurements.voltage).toBeCloseTo(2.4, 6);
        expect(viewModel.viewMap.get('R1').voltageValue).not.toBeCloseTo(-2.4, 6);
    });

    it('zeros a connected ground even when the currents map carries a non-zero reading', () => {
        const viewModel = projectResultV2({
            netlist: {
                components: [{ id: 'GND', type: 'Ground', nodes: [0], params: {} }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 5],
                currents: new Map([['GND', 1.2]])
            }
        });
        const view = viewModel.viewMap.get('GND');
        expect(view.status).toBe('ok');
        expect(view.currentValue).toBe(0);
        expect(view.voltageValue).toBe(0);
        expect(view.powerValue).toBe(0);
    });

    it('forces ideal voltmeter current to zero without zeroing a 6V reading', () => {
        const viewModel = projectResultV2({
            netlist: {
                components: [{
                    id: 'VM1',
                    type: 'Voltmeter',
                    nodes: [1, 0],
                    params: { resistance: Infinity, range: 15 }
                }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 6],
                currents: new Map([['VM1', 0.08]])
            }
        });
        const view = viewModel.viewMap.get('VM1');
        expect(view.currentValue).toBe(0);
        expect(view.voltageValue).toBeCloseTo(6, 6);
        expect(view.powerValue).toBe(0);
        expect(view.currentValue).not.toBe(0.08);
    });

    it('does not force current to zero for a finite-resistance voltmeter', () => {
        const viewModel = projectResultV2({
            netlist: {
                components: [{
                    id: 'VM1',
                    type: 'Voltmeter',
                    nodes: [1, 0],
                    params: { resistance: 1000 }
                }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 6],
                currents: new Map([['VM1', 0.006]])
            }
        });
        expect(viewModel.viewMap.get('VM1').currentValue).toBeCloseTo(0.006, 12);
        expect(viewModel.viewMap.get('VM1').voltageValue).toBeCloseTo(6, 6);
    });

    it('zeros a component whose netlist nodes are unassigned even if a current key exists', () => {
        const viewModel = projectResultV2({
            netlist: {
                components: [{ id: 'R1', type: 'Resistor', nodes: [-1, -1], params: {} }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 5],
                currents: new Map([['R1', 0.4]])
            }
        });
        const view = viewModel.viewMap.get('R1');
        expect(view.status).toBe('disconnected');
        expect(view.currentValue).toBe(0);
        expect(view.currentValue).not.toBe(0.4);
        expect(view.voltageValue).toBe(0);
    });

    it('projects rheostat segment voltages from connectionMode instead of always using left-right', () => {
        const voltages = [0, 6, 1, 4];
        const nodes = [1, 2, 3];
        const base = {
            id: 'RH1',
            type: 'Rheostat',
            nodes,
            params: { connectionMode: 'left-slider', maxResistance: 100, position: 0.5 }
        };
        expect(base.params.connectionMode).toBe('left-slider');

        const leftSlider = projectResultV2({
            netlist: { components: [base] },
            solveResult: { valid: true, voltages, currents: new Map([['RH1', 0.05]]) }
        }).viewMap.get('RH1');
        expect(leftSlider.voltageValue).toBeCloseTo(2, 12);
        expect(leftSlider.voltageSegLeft).toBeCloseTo(2, 12);
        expect(leftSlider.voltageSegRight).toBeUndefined();
        expect(leftSlider.voltageValue).not.toBeCloseTo(5, 12);

        const leftRight = projectResultV2({
            netlist: {
                components: [{
                    ...base,
                    params: { connectionMode: 'left-right', maxResistance: 100, position: 0.5 }
                }]
            },
            solveResult: { valid: true, voltages, currents: new Map([['RH1', 0.05]]) }
        }).viewMap.get('RH1');
        expect(leftRight.voltageValue).toBeCloseTo(5, 12);
        expect(leftRight.voltageSegLeft).toBeCloseTo(5, 12);

        const rightSlider = projectResultV2({
            netlist: {
                components: [{
                    ...base,
                    params: { connectionMode: 'right-slider', maxResistance: 100, position: 0.5 }
                }]
            },
            solveResult: { valid: true, voltages, currents: new Map([['RH1', 0.05]]) }
        }).viewMap.get('RH1');
        expect(rightSlider.voltageValue).toBeCloseTo(3, 12);
        expect(rightSlider.voltageSegRight).toBeCloseTo(3, 12);
        expect(rightSlider.voltageSegLeft).toBeUndefined();
        expect(rightSlider.voltageValue).not.toBeCloseTo(2, 12);
        expect(rightSlider.voltageValue).not.toBeCloseTo(5, 12);

        const allMode = projectResultV2({
            netlist: {
                components: [{
                    ...base,
                    params: { connectionMode: 'all', maxResistance: 100, position: 0.5 }
                }]
            },
            solveResult: { valid: true, voltages, currents: new Map([['RH1', 0.05]]) }
        }).viewMap.get('RH1');
        expect(allMode.voltageValue).toBeCloseTo(5, 12);
        expect(allMode.voltageSegLeft).toBeCloseTo(2, 12);
        expect(allMode.voltageSegRight).toBeCloseTo(3, 12);
    });

    it('projects SPDT voltage from the conducting throw, not the idle throw', () => {
        const voltages = [0, 5, 2, 9];
        const nodes = [1, 2, 3];
        const sideA = projectResultV2({
            netlist: {
                components: [{
                    id: 'S1',
                    type: 'SPDTSwitch',
                    nodes,
                    params: { position: 'a' }
                }]
            },
            solveResult: { valid: true, voltages, currents: new Map([['S1', -0.2]]) }
        }).viewMap.get('S1');
        expect(sideA.voltageValue).toBeCloseTo(3, 12);
        expect(sideA.powerValue).toBeCloseTo(0.6, 12);
        expect(sideA.voltageValue).not.toBeCloseTo(4, 12);

        const sideB = projectResultV2({
            netlist: {
                components: [{
                    id: 'S1',
                    type: 'SPDTSwitch',
                    nodes,
                    params: { position: 'b' }
                }]
            },
            solveResult: { valid: true, voltages, currents: new Map([['S1', -0.2]]) }
        }).viewMap.get('S1');
        expect(sideB.voltageValue).toBeCloseTo(4, 12);
        expect(sideB.powerValue).toBeCloseTo(0.8, 12);
    });

    it('projects bulb brightness from power/ratedPower and LED brightness from conducting current', () => {
        const bulb = projectResultV2({
            netlist: {
                components: [{
                    id: 'B1',
                    type: 'Bulb',
                    nodes: [1, 0],
                    params: { resistance: 50, ratedPower: 5 }
                }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 10],
                currents: new Map([['B1', 0.2]])
            }
        }).viewMap.get('B1');
        expect(bulb.powerValue).toBeCloseTo(2, 12);
        expect(bulb.brightness).toBeCloseTo(0.4, 12);
        expect(bulb.brightness).not.toBe(1);
        expect(bulb.brightness).not.toBeCloseTo(0.2 / 0.02, 12);

        const state = new SimulationStateV2();
        state.applyPatch({ id: 'LED1', type: 'LED' }, { conducting: true });
        const ledOn = projectResultV2({
            netlist: {
                components: [{
                    id: 'LED1',
                    type: 'LED',
                    nodes: [1, 0],
                    params: { ratedCurrent: 0.02 }
                }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 2],
                currents: new Map([['LED1', 0.01]]),
                nextState: state
            }
        }).viewMap.get('LED1');
        expect(ledOn.conducting).toBe(true);
        expect(ledOn.brightness).toBeCloseTo(0.5, 12);

        const offState = new SimulationStateV2();
        offState.applyPatch({ id: 'LED1', type: 'LED' }, { conducting: false });
        const ledOff = projectResultV2({
            netlist: {
                components: [{
                    id: 'LED1',
                    type: 'LED',
                    nodes: [1, 0],
                    params: { ratedCurrent: 0.02 }
                }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 2],
                currents: new Map([['LED1', 0.01]]),
                nextState: offState
            }
        }).viewMap.get('LED1');
        expect(ledOff.conducting).toBe(false);
        expect(ledOff.brightness).toBe(0);
    });

    it('projects relay coil voltage plus contact power, not coil-only |V·I|', () => {
        const state = new SimulationStateV2();
        state.applyPatch({ id: 'K1', type: 'Relay' }, { energized: true });
        const view = projectResultV2({
            netlist: {
                components: [{
                    id: 'K1',
                    type: 'Relay',
                    nodes: [1, 0, 2, 3],
                    params: { contactOnResistance: 2 }
                }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 5, 12, 2],
                currents: new Map([['K1', 0.1]]),
                nextState: state
            }
        }).viewMap.get('K1');
        expect(view.voltageValue).toBeCloseTo(5, 12);
        expect(view.voltageValue).not.toBeCloseTo(10, 12);
        expect(view.powerValue).toBeCloseTo(50.5, 12);
        expect(view.powerValue).not.toBeCloseTo(0.5, 12);
        expect(view.powerValue).not.toBeCloseTo(1, 12);
        expect(view.energized).toBe(true);
    });

    it('copies motor and fuse dynamic fields from nextState', () => {
        const state = new SimulationStateV2();
        state.applyPatch({ id: 'M1', type: 'Motor' }, { speed: 12, backEmf: 1.2 });
        state.applyPatch({ id: 'F1', type: 'Fuse' }, { blown: true, i2tAccum: 0.4 });
        state.applyPatch({ id: 'D1', type: 'Diode' }, { conducting: true });
        const viewModel = projectResultV2({
            netlist: {
                components: [
                    { id: 'M1', type: 'Motor', nodes: [1, 0], params: { resistance: 5 } },
                    { id: 'F1', type: 'Fuse', nodes: [1, 0], params: { ratedCurrent: 3 } },
                    { id: 'D1', type: 'Diode', nodes: [1, 0], params: {} }
                ]
            },
            solveResult: {
                valid: true,
                voltages: [0, 6],
                currents: new Map([
                    ['M1', 1.2],
                    ['F1', 2],
                    ['D1', 0.01]
                ]),
                nextState: state
            }
        });
        const motor = viewModel.viewMap.get('M1');
        expect(motor.speed).toBe(12);
        expect(motor.backEmf).toBe(1.2);
        const fuse = viewModel.viewMap.get('F1');
        expect(fuse.blown).toBe(true);
        expect(fuse.i2tAccum).toBe(0.4);
        expect(viewModel.viewMap.get('D1').conducting).toBe(true);
    });

    it('zeros a shorted two-terminal even when a current key is present', () => {
        const view = projectResultV2({
            netlist: {
                components: [{ id: 'R1', type: 'Resistor', nodes: [1, 1], params: {} }]
            },
            solveResult: {
                valid: true,
                voltages: [0, 5],
                currents: new Map([['R1', 0.3]])
            }
        }).viewMap.get('R1');
        expect(view.status).toBe('shorted');
        expect(view.currentValue).toBe(0);
        expect(view.currentValue).not.toBe(0.3);
        expect(view.voltageValue).toBe(0);
        expect(view.powerValue).toBe(0);
    });

    it('projects non-zero voltage for a wire-connected resistor whose circuitModel has no nodes', () => {
        const circuit = createTestCircuit();
        addLiveComponent(circuit, 'PowerSource', 'V1', {
            voltage: 3,
            internalResistance: 2
        }, { x: 100, y: 100 });
        addLiveComponent(circuit, 'Resistor', 'R1', {
            resistance: 8
        }, { x: 300, y: 100 });
        connectWire(circuit, 'W1', 'V1', 0, 'R1', 0);
        connectWire(circuit, 'W2', 'V1', 1, 'R1', 1);

        const snapshot = snapshotCircuitModel(circuit);
        expect(snapshot.components.every((component) => component.nodes === undefined)).toBe(true);
        expect(snapshot.wires).toHaveLength(2);
        expect(snapshot.wires.every((wire) => wire.a && wire.b)).toBe(true);

        const result = runSimulationStepV2({
            circuitModel: snapshot,
            simulationState: new SimulationStateV2(),
            options: {
                dt: 0.01,
                getTerminalWorldPosition: (_componentId, terminalIndex, comp) => (
                    getTerminalWorldPosition(comp, terminalIndex)
                )
            }
        });

        const resistor = result.projection.viewMap.get('R1');
        expect(resistor.status).toBe('ok');
        expect(resistor.currentValue).toBeCloseTo(0.3, 6);
        expect(resistor.voltageValue).toBeCloseTo(2.4, 6);
        expect(resistor.voltageValue).not.toBe(0);
        expect(resistor.voltageValue).not.toBeCloseTo(3, 6);
        expectNoNodesOnView(resistor);
    });
});
