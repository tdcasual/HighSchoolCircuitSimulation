import { describe, expect, it } from 'vitest';
import { RuntimeActionRouter } from '../src/app/RuntimeActionRouter.js';
import { SimulationRefreshSkill } from '../src/ai/skills/SimulationRefreshSkill.js';
import {
    applyComponentPropertyDialogChanges,
    getComponentPropertyDialogFields
} from '../src/ui/interaction/ComponentPropertySchema.js';
import {
    addComponent,
    connectWire,
    createTestCircuit,
    viewOf
} from './helpers/circuitTestUtils.js';

function buildEnergizedRelayCircuit() {
    const circuit = createTestCircuit();
    const coilSource = addComponent(circuit, 'PowerSource', 'Vcoil', {
        voltage: 5,
        internalResistance: 0
    });
    const loadSource = addComponent(circuit, 'PowerSource', 'Vload', {
        voltage: 10,
        internalResistance: 0
    });
    const relay = addComponent(circuit, 'Relay', 'K1', {
        coilResistance: 100,
        pullInCurrent: 0.02,
        dropOutCurrent: 0.01,
        contactOnResistance: 1e-3,
        contactOffResistance: 1e12,
        energized: false
    });
    const load = addComponent(circuit, 'Resistor', 'Rload', { resistance: 10 });
    connectWire(circuit, 'W1', coilSource, 0, relay, 0);
    connectWire(circuit, 'W2', relay, 1, coilSource, 1);
    connectWire(circuit, 'W3', loadSource, 0, relay, 2);
    connectWire(circuit, 'W4', relay, 3, load, 0);
    connectWire(circuit, 'W5', load, 1, loadSource, 1);
    return { circuit, relay, load };
}

function buildFuseCircuit() {
    const circuit = createTestCircuit();
    const source = addComponent(circuit, 'PowerSource', 'V1', {
        voltage: 10,
        internalResistance: 0
    });
    const fuse = addComponent(circuit, 'Fuse', 'F1', {
        ratedCurrent: 0.01,
        i2tThreshold: 1e-9,
        coldResistance: 0.05,
        blownResistance: 1e12,
        blown: false
    });
    const load = addComponent(circuit, 'Resistor', 'R1', { resistance: 1 });
    connectWire(circuit, 'W1', source, 0, fuse, 0);
    connectWire(circuit, 'W2', fuse, 1, load, 0);
    connectWire(circuit, 'W3', load, 1, source, 1);
    return { circuit, fuse };
}

function softenFuseSoItWillNotRemelt(circuit, fuse) {
    fuse.ratedCurrent = 10;
    fuse.i2tThreshold = 100;
    circuit.markSolverCircuitDirty();
}

function applyFuseDialogFromOverlay(circuit, fuse, { unblow = false } = {}) {
    const view = viewOf(circuit, fuse);
    applyComponentPropertyDialogChanges({
        component: fuse,
        readFieldValue: (id) => {
            if (id === 'edit-fuse-blown') return unblow ? 'false' : (view.blown ? 'true' : 'false');
            if (id === 'edit-rated-current') return String(fuse.ratedCurrent);
            if (id === 'edit-i2t-threshold') return String(fuse.i2tThreshold);
            if (id === 'edit-cold-resistance') return String(fuse.coldResistance);
            if (id === 'edit-blown-resistance') return String(fuse.blownResistance);
            return '';
        },
        safeParseFloat: (raw, fallback) => {
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : fallback;
        },
        readCheckbox: (id) => (id === 'edit-fuse-blown' ? (unblow ? false : !!view.blown) : false)
    });
    circuit.markSolverCircuitDirty();
    circuit.clearFuseSolverState(fuse);
}

describe('classroom ViewMap dynamics', () => {
    it('uses ViewMap energized for relay contact terminal flow', () => {
        const { circuit, relay, load } = buildEnergizedRelayCircuit();
        circuit.startSimulation();
        circuit.step();

        expect(relay.energized).toBe(false);
        expect(viewOf(circuit, relay).energized).toBe(true);
        expect(circuit.lastResults.currents.get(load.id)).toBeCloseTo(0.9999, 3);

        const contactFlow = circuit.getTerminalCurrentFlow(relay, 2, circuit.lastResults);
        expect(Math.abs(contactFlow)).toBeCloseTo(0.9999, 3);
        expect(circuit.componentProvidesResistiveDamping(relay)).toBe(true);

        circuit.stopSimulation();
    });

    it('fills the fuse dialog blown checkbox from ViewMap after a classroom melt', () => {
        const { circuit, fuse } = buildFuseCircuit();
        circuit.startSimulation();
        for (let i = 0; i < 8; i++) circuit.step();

        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(true);
        const blownField = getComponentPropertyDialogFields(viewOf(circuit, fuse))
            .find((field) => field.key === 'blown');
        expect(blownField?.value).toBe(true);

        circuit.stopSimulation();
    });

    it('keeps a classroom-melted fuse blown when the dialog is confirmed unchanged', () => {
        const { circuit, fuse } = buildFuseCircuit();
        circuit.startSimulation();
        for (let i = 0; i < 8; i++) circuit.step();
        expect(viewOf(circuit, fuse).blown).toBe(true);

        softenFuseSoItWillNotRemelt(circuit, fuse);
        applyFuseDialogFromOverlay(circuit, fuse, { unblow: false });
        circuit.step();

        expect(fuse.blown).toBe(true);
        expect(viewOf(circuit, fuse).blown).toBe(true);
        expect(Math.abs(circuit.lastResults.currents.get(fuse.id) || 0)).toBeLessThan(1e-6);

        circuit.stopSimulation();
    });

    it('keeps a classroom-melted fuse blown across stop/start without a dialog confirm', () => {
        const { circuit, fuse } = buildFuseCircuit();
        circuit.startSimulation();
        for (let i = 0; i < 8; i++) circuit.step();
        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(true);

        circuit.stopSimulation();
        softenFuseSoItWillNotRemelt(circuit, fuse);
        circuit.startSimulation();
        circuit.step();

        expect(fuse.blown).toBe(true);
        expect(viewOf(circuit, fuse).blown).toBe(true);
        expect(Math.abs(circuit.lastResults.currents.get(fuse.id) || 0)).toBeLessThan(1e-6);

        circuit.stopSimulation();
    });

    it('still conducts after stop/start when the dialog unblows the fuse', () => {
        const { circuit, fuse } = buildFuseCircuit();
        circuit.startSimulation();
        for (let i = 0; i < 8; i++) circuit.step();

        softenFuseSoItWillNotRemelt(circuit, fuse);
        applyFuseDialogFromOverlay(circuit, fuse, { unblow: true });
        circuit.stopSimulation();
        circuit.startSimulation();
        circuit.step();

        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(false);
        expect(Math.abs(circuit.lastResults.currents.get(fuse.id) || 0)).toBeGreaterThan(0.1);

        circuit.stopSimulation();
    });

    it('treats pulled-in relay contacts as damping for the contact node pair', () => {
        const circuit = createTestCircuit();
        const coilSource = addComponent(circuit, 'PowerSource', 'Vcoil', {
            voltage: 5,
            internalResistance: 0
        });
        const relay = addComponent(circuit, 'Relay', 'K1', {
            coilResistance: 100,
            pullInCurrent: 0.02,
            dropOutCurrent: 0.01,
            contactOnResistance: 1e-3,
            contactOffResistance: 1e12,
            energized: false
        });
        const c1 = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 1e-3 });
        const c2 = addComponent(circuit, 'Capacitor', 'C2', { capacitance: 2e-3 });
        connectWire(circuit, 'W1', coilSource, 0, relay, 0);
        connectWire(circuit, 'W2', relay, 1, coilSource, 1);
        connectWire(circuit, 'Wc1a', relay, 2, c1, 0);
        connectWire(circuit, 'Wc1b', c1, 1, relay, 3);
        connectWire(circuit, 'Wc2a', relay, 2, c2, 0);
        connectWire(circuit, 'Wc2b', c2, 1, relay, 3);

        expect(circuit.validateSimulationTopology(0).ok).toBe(false);

        circuit.startSimulation();
        circuit.step();
        expect(viewOf(circuit, relay).energized).toBe(true);
        expect(circuit.validateSimulationTopology().ok).toBe(true);

        circuit.stopSimulation();
        expect(viewOf(circuit, relay).energized).toBe(true);
        expect(circuit.validateSimulationTopology(0).ok).toBe(false);
        const router = new RuntimeActionRouter({ circuit });
        expect(router.startSimulation()).toBe(false);
        expect(circuit.isRunning).toBe(false);
    });

    it('does not latch a noncommitted first-shot refresh melt at Start', () => {
        const { circuit, fuse } = buildFuseCircuit();
        const preview = SimulationRefreshSkill.run({ circuit });
        expect(preview.ok).toBe(true);
        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(true);

        softenFuseSoItWillNotRemelt(circuit, fuse);
        circuit.startSimulation();
        circuit.step();

        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(false);
        expect(Math.abs(circuit.lastResults.currents.get(fuse.id) || 0)).toBeGreaterThan(0.1);

        circuit.stopSimulation();
    });

    it('does not latch a dirty idle-refresh preview melt across restart', () => {
        const { circuit, fuse } = buildFuseCircuit();
        fuse.i2tThreshold = 1.5;
        circuit.startSimulation();
        circuit.step();
        expect(viewOf(circuit, fuse).blown).toBe(false);
        circuit.stopSimulation();

        circuit.markSolverCircuitDirty();
        SimulationRefreshSkill.run({ circuit });
        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(true);

        softenFuseSoItWillNotRemelt(circuit, fuse);
        circuit.startSimulation();
        circuit.step();

        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(false);
        expect(Math.abs(circuit.lastResults.currents.get(fuse.id) || 0)).toBeGreaterThan(0.1);

        circuit.stopSimulation();
    });

    it('does not let a preview fuse melt false-block a capacitor loop at Start', () => {
        const { circuit, fuse } = buildFuseCircuit();
        const c1 = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 1e-3 });
        const c2 = addComponent(circuit, 'Capacitor', 'C2', { capacitance: 2e-3 });
        connectWire(circuit, 'Wc1a', fuse, 0, c1, 0);
        connectWire(circuit, 'Wc1b', c1, 1, fuse, 1);
        connectWire(circuit, 'Wc2a', fuse, 0, c2, 0);
        connectWire(circuit, 'Wc2b', c2, 1, fuse, 1);

        expect(circuit.validateSimulationTopology(0).ok).toBe(true);
        SimulationRefreshSkill.run({ circuit });
        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(true);
        expect(circuit.solverBackend.getState(fuse)?.blown).toBeFalsy();
        expect(circuit.validateSimulationTopology(0).ok).toBe(true);
        expect(circuit.getComponentProperties(fuse).blown).toBe(true);
        const previewProperties = circuit.toJSON().components.find((entry) => entry.id === fuse.id).properties;
        expect(previewProperties.blown).toBe(false);
        expect(previewProperties.i2tAccum).toBe(0);
        expect(circuit.componentProvidesResistiveDamping(fuse)).toBe(true);

        const router = new RuntimeActionRouter({ circuit });
        expect(router.startSimulation()).toBe(true);
        circuit.stopSimulation();
    });

    it('does not persist a preview fuse i2tAccum through save/reload', () => {
        const { circuit, fuse } = buildFuseCircuit();
        SimulationRefreshSkill.run({ circuit });
        expect(viewOf(circuit, fuse).blown).toBe(true);
        expect(circuit.getComponentProperties(fuse).i2tAccum).toBeGreaterThan(0);
        const saved = circuit.toJSON().components.find((entry) => entry.id === fuse.id).properties;
        expect(saved.blown).toBe(false);
        expect(saved.i2tAccum).toBe(0);

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        const restoredFuse = restored.components.get(fuse.id);
        expect(restoredFuse.i2tAccum).toBe(0);
        softenFuseSoItWillNotRemelt(restored, restoredFuse);
        const router = new RuntimeActionRouter({ circuit: restored });
        expect(router.startSimulation()).toBe(true);
        restored.step();
        expect(viewOf(restored, restoredFuse).blown).toBe(false);
        expect(Math.abs(restored.lastResults.currents.get(restoredFuse.id) || 0)).toBeGreaterThan(0.1);
        restored.stopSimulation();
    });

    it('blocks Start of a capacitor loop after a committed classroom fuse melt', () => {
        const { circuit, fuse } = buildFuseCircuit();
        const c1 = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 1e-3 });
        const c2 = addComponent(circuit, 'Capacitor', 'C2', { capacitance: 2e-3 });
        connectWire(circuit, 'Wc1a', fuse, 0, c1, 0);
        connectWire(circuit, 'Wc1b', c1, 1, fuse, 1);
        connectWire(circuit, 'Wc2a', fuse, 0, c2, 0);
        connectWire(circuit, 'Wc2b', c2, 1, fuse, 1);

        circuit.startSimulation();
        for (let i = 0; i < 8; i++) circuit.step();
        expect(viewOf(circuit, fuse).blown).toBe(true);
        expect(circuit.solverBackend.getState(fuse)?.blown).toBe(true);
        circuit.stopSimulation();

        expect(circuit.validateSimulationTopology(0).ok).toBe(false);
        expect(circuit.validateSimulationTopology(0).error?.code).toBe('TOPO_CAPACITOR_LOOP_NO_RESISTANCE');
        expect(circuit.getComponentProperties(fuse).blown).toBe(true);
        const saved = circuit.toJSON().components.find((entry) => entry.id === fuse.id).properties;
        expect(saved.blown).toBe(true);
        expect(saved.i2tAccum).toBeGreaterThan(0);
        expect(circuit.componentProvidesResistiveDamping(fuse)).toBe(false);
        const router = new RuntimeActionRouter({ circuit });
        expect(router.startSimulation()).toBe(false);
    });

    it('clears V2 fuse state when the dialog unblows the fuse', () => {
        const { circuit, fuse } = buildFuseCircuit();
        circuit.startSimulation();
        for (let i = 0; i < 8; i++) circuit.step();

        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(true);
        expect(circuit.componentProvidesResistiveDamping(fuse)).toBe(false);

        softenFuseSoItWillNotRemelt(circuit, fuse);
        applyFuseDialogFromOverlay(circuit, fuse, { unblow: true });
        circuit.step();

        expect(fuse.blown).toBe(false);
        expect(viewOf(circuit, fuse).blown).toBe(false);
        expect(circuit.getComponentProperties(fuse).blown).toBe(false);
        expect(circuit.componentProvidesResistiveDamping(fuse)).toBe(true);

        circuit.stopSimulation();
    });

    it('does not extra-integrate a running capacitor on simulation_refresh', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);
        circuit.dt = 0.01;

        circuit.startSimulation();
        circuit.step();
        const voltageAfterStep = viewOf(circuit, capacitor).voltageValue;
        const simTime = circuit.simTime;

        const result = SimulationRefreshSkill.run({ circuit });
        expect(result.ok).toBe(true);
        expect(circuit.simTime).toBe(simTime);
        expect(viewOf(circuit, capacitor).voltageValue).toBeCloseTo(voltageAfterStep, 12);

        circuit.step();
        expect(circuit.simTime).toBeCloseTo(simTime + circuit.dt, 12);
        expect(viewOf(circuit, capacitor).voltageValue).toBeGreaterThan(voltageAfterStep);
        expect(viewOf(circuit, capacitor).voltageValue).toBeLessThan(0.9);

        circuit.stopSimulation();
    });

    it('refreshes measurements after a stopped parameter edit without committing backend state', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 10 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, source, 1);

        circuit.startSimulation();
        circuit.step();
        expect(viewOf(circuit, resistor).currentValue).toBeCloseTo(0.5, 6);
        const simTime = circuit.simTime;
        circuit.stopSimulation();

        resistor.resistance = 100;
        circuit.markSolverCircuitDirty();
        const result = SimulationRefreshSkill.run({ circuit });
        expect(result.ok).toBe(true);
        expect(circuit.simTime).toBe(simTime);
        expect(viewOf(circuit, resistor).currentValue).toBeCloseTo(0.05, 6);

        const second = SimulationRefreshSkill.run({ circuit });
        expect(second.ok).toBe(true);
        expect(viewOf(circuit, resistor).currentValue).toBeCloseTo(0.05, 6);
        expect(circuit.simTime).toBe(simTime);
    });

    it('does not extra-integrate a stopped capacitor on simulation_refresh', () => {
        const circuit = createTestCircuit();
        const source = addComponent(circuit, 'PowerSource', 'V1', {
            voltage: 5,
            internalResistance: 0
        });
        const resistor = addComponent(circuit, 'Resistor', 'R1', { resistance: 100 });
        const capacitor = addComponent(circuit, 'Capacitor', 'C1', { capacitance: 0.001 });
        connectWire(circuit, 'W1', source, 0, resistor, 0);
        connectWire(circuit, 'W2', resistor, 1, capacitor, 0);
        connectWire(circuit, 'W3', capacitor, 1, source, 1);
        circuit.dt = 0.01;

        circuit.startSimulation();
        circuit.step();
        const voltageAfterStep = viewOf(circuit, capacitor).voltageValue;
        const simTime = circuit.simTime;
        circuit.stopSimulation();

        const result = SimulationRefreshSkill.run({ circuit });
        expect(result.ok).toBe(true);
        expect(circuit.simTime).toBe(simTime);
        expect(viewOf(circuit, capacitor).voltageValue).toBeCloseTo(voltageAfterStep, 12);
    });

    it('does not persist a preview relay pull-in through save/reload', () => {
        const { circuit, relay } = buildEnergizedRelayCircuit();
        SimulationRefreshSkill.run({ circuit });
        expect(relay.energized).toBe(false);
        expect(viewOf(circuit, relay).energized).toBe(true);
        expect(circuit.getComponentProperties(relay).energized).toBe(true);
        expect(circuit.toJSON().components.find((entry) => entry.id === relay.id).properties.energized).toBe(false);

        const restored = createTestCircuit();
        restored.fromJSON(circuit.toJSON());
        const restoredRelay = restored.components.get(relay.id);
        expect(restoredRelay.energized).toBe(false);
        expect(restored.getComponentProperties(restoredRelay).energized).toBe(false);
        const router = new RuntimeActionRouter({ circuit: restored });
        expect(router.startSimulation()).toBe(true);
        restored.step();
        expect(viewOf(restored, restoredRelay).energized).toBe(true);
        restored.stopSimulation();
    });

    it('still saves a committed classroom relay pull-in', () => {
        const { circuit, relay } = buildEnergizedRelayCircuit();
        circuit.startSimulation();
        circuit.step();
        expect(relay.energized).toBe(false);
        expect(viewOf(circuit, relay).energized).toBe(true);
        expect(circuit.solverBackend.getState(relay)?.energized).toBe(true);
        expect(circuit.toJSON().components.find((entry) => entry.id === relay.id).properties.energized).toBe(true);
        circuit.stopSimulation();
        expect(circuit.toJSON().components.find((entry) => entry.id === relay.id).properties.energized).toBe(true);
    });
});
