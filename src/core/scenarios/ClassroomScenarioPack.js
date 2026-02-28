import { Circuit } from '../../engine/Circuit.js';
import { createComponent } from '../../components/Component.js';
import { getTerminalWorldPosition } from '../../utils/TerminalGeometry.js';
import { CircuitSerializer } from '../io/CircuitSerializer.js';

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function createScenarioBuilderContext() {
    const circuit = new Circuit();
    let componentIndex = 0;

    const addComponent = (type, id, props = {}) => {
        const column = componentIndex % 6;
        const row = Math.floor(componentIndex / 6);
        const x = props.x ?? (120 + column * 180);
        const y = props.y ?? (120 + row * 150);
        componentIndex += 1;

        const component = createComponent(type, x, y, id);
        const normalizedProps = { ...props };
        delete normalizedProps.x;
        delete normalizedProps.y;
        Object.assign(component, normalizedProps);
        circuit.addComponent(component);
        return component;
    };

    const connect = (wireId, aComp, aTerminal, bComp, bTerminal) => {
        const a = getTerminalWorldPosition(aComp, aTerminal);
        const b = getTerminalWorldPosition(bComp, bTerminal);
        if (!a || !b) {
            throw new Error(`invalid terminal position for wire ${wireId}`);
        }
        circuit.addWire({
            id: wireId,
            a,
            b,
            aRef: { componentId: aComp.id, terminalIndex: aTerminal },
            bRef: { componentId: bComp.id, terminalIndex: bTerminal }
        });
    };

    const addProbe = (probe) => {
        circuit.addObservationProbe(probe);
    };

    return {
        circuit,
        addComponent,
        connect,
        addProbe
    };
}

function buildScenarioJson(definition) {
    const ctx = createScenarioBuilderContext();
    definition.build(ctx);
    const json = CircuitSerializer.serialize(ctx.circuit);
    const timestamp = Date.UTC(2026, 2, 23, 0, 0, 0, 0);
    json.meta = {
        ...(json.meta || {}),
        timestamp,
        name: definition.name,
        scenarioId: definition.id,
        scenarioPack: 'classroom-v0.9',
        scenarioDescription: definition.description
    };
    return json;
}

const SCENARIO_DEFINITIONS = Object.freeze([
    Object.freeze({
        id: 'classroom-series',
        name: '串联基础回路',
        description: '单电源 + 两个串联电阻，观察总电压分配与电流一致性。',
        simulation: Object.freeze({ dt: 0.01, steps: 1 }),
        build({ addComponent, connect }) {
            const source = addComponent('PowerSource', 'V1', { voltage: 6, internalResistance: 0.2, x: 120, y: 120 });
            const r1 = addComponent('Resistor', 'R1', { resistance: 12, x: 330, y: 120 });
            const r2 = addComponent('Resistor', 'R2', { resistance: 18, x: 540, y: 120 });
            connect('W1', source, 0, r1, 0);
            connect('W2', r1, 1, r2, 0);
            connect('W3', r2, 1, source, 1);
        }
    }),
    Object.freeze({
        id: 'classroom-parallel',
        name: '并联分流回路',
        description: '单电源 + 两个并联支路，比较支路电流与等效电阻变化。',
        simulation: Object.freeze({ dt: 0.01, steps: 1 }),
        build({ addComponent, connect }) {
            const source = addComponent('PowerSource', 'V1', { voltage: 9, internalResistance: 0.2, x: 120, y: 200 });
            const r1 = addComponent('Resistor', 'R1', { resistance: 30, x: 360, y: 120 });
            const r2 = addComponent('Resistor', 'R2', { resistance: 60, x: 360, y: 280 });
            connect('W1', source, 0, r1, 0);
            connect('W2', source, 0, r2, 0);
            connect('W3', r1, 1, source, 1);
            connect('W4', r2, 1, source, 1);
        }
    }),
    Object.freeze({
        id: 'classroom-divider',
        name: '分压器场景',
        description: '两电阻分压结构，适合讲解中点电压与负载影响。',
        simulation: Object.freeze({ dt: 0.01, steps: 1 }),
        build({ addComponent, connect }) {
            const source = addComponent('PowerSource', 'V1', { voltage: 12, internalResistance: 0, x: 120, y: 120 });
            const r1 = addComponent('Resistor', 'R1', { resistance: 100, x: 340, y: 120 });
            const r2 = addComponent('Resistor', 'R2', { resistance: 220, x: 560, y: 120 });
            connect('W1', source, 0, r1, 0);
            connect('W2', r1, 1, r2, 0);
            connect('W3', r2, 1, source, 1);
        }
    }),
    Object.freeze({
        id: 'classroom-rc-charge-discharge',
        name: 'RC 充放电基础',
        description: '开关闭合时充电，断开后可观察电容保持与放电过程。',
        simulation: Object.freeze({ dt: 0.01, steps: 8 }),
        build({ addComponent, connect }) {
            const source = addComponent('PowerSource', 'V1', { voltage: 6, internalResistance: 0, x: 120, y: 120 });
            const sw = addComponent('Switch', 'S1', { closed: true, x: 300, y: 120 });
            const resistor = addComponent('Resistor', 'R1', { resistance: 100, x: 480, y: 120 });
            const capacitor = addComponent('Capacitor', 'C1', { capacitance: 0.001, x: 680, y: 120 });
            connect('W1', source, 0, sw, 0);
            connect('W2', sw, 1, resistor, 0);
            connect('W3', resistor, 1, capacitor, 0);
            connect('W4', capacitor, 1, source, 1);
        }
    }),
    Object.freeze({
        id: 'classroom-motor-feedback',
        name: '电机反电动势',
        description: '电源驱动电机回路，观察转速上升时反电动势对电流的抑制。',
        simulation: Object.freeze({ dt: 0.01, steps: 12 }),
        build({ addComponent, connect }) {
            const source = addComponent('PowerSource', 'V1', { voltage: 9, internalResistance: 0.3, x: 120, y: 120 });
            const motor = addComponent('Motor', 'M1', {
                resistance: 5,
                torqueConstant: 0.1,
                emfConstant: 0.1,
                inertia: 0.02,
                loadTorque: 0.02,
                x: 360,
                y: 120
            });
            const resistor = addComponent('Resistor', 'R1', { resistance: 4, x: 600, y: 120 });
            connect('W1', source, 0, motor, 0);
            connect('W2', motor, 1, resistor, 0);
            connect('W3', resistor, 1, source, 1);
        }
    }),
    Object.freeze({
        id: 'classroom-probe-measurement',
        name: '探针与仪表测量',
        description: '串联电流表 + 并联电压表 + 观测探针，演示测量路径。',
        simulation: Object.freeze({ dt: 0.01, steps: 2 }),
        build({ addComponent, connect, addProbe }) {
            const source = addComponent('PowerSource', 'V1', { voltage: 6, internalResistance: 0.2, x: 120, y: 120 });
            const ammeter = addComponent('Ammeter', 'A1', { resistance: 0, range: 3, selfReading: true, x: 300, y: 120 });
            const resistor = addComponent('Resistor', 'R1', { resistance: 20, x: 500, y: 120 });
            const voltmeter = addComponent('Voltmeter', 'VM1', { resistance: Infinity, range: 15, selfReading: true, x: 500, y: 260 });
            connect('W1', source, 0, ammeter, 0);
            connect('W2', ammeter, 1, resistor, 0);
            connect('W3', resistor, 1, source, 1);
            connect('W4', voltmeter, 0, resistor, 0);
            connect('W5', voltmeter, 1, resistor, 1);

            addProbe({
                id: 'P_I1',
                type: 'WireCurrentProbe',
                wireId: 'W2',
                label: '支路电流探针'
            });
            addProbe({
                id: 'P_U1',
                type: 'NodeVoltageProbe',
                wireId: 'W2',
                label: '节点电压探针'
            });
        }
    })
]);

let cachedScenarioPack = null;

function createScenarioPackInternal() {
    return SCENARIO_DEFINITIONS.map((definition) => {
        const circuit = buildScenarioJson(definition);
        return Object.freeze({
            id: definition.id,
            name: definition.name,
            description: definition.description,
            simulation: { ...definition.simulation },
            circuit
        });
    });
}

export function getClassroomScenarioPack() {
    if (!cachedScenarioPack) {
        cachedScenarioPack = createScenarioPackInternal();
    }
    return cachedScenarioPack.map((item) => ({
        ...item,
        simulation: { ...item.simulation },
        circuit: cloneJson(item.circuit)
    }));
}

export function getClassroomScenarioById(id) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return null;
    const scenarios = getClassroomScenarioPack();
    return scenarios.find((scenario) => scenario.id === normalizedId) || null;
}

