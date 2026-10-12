import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { P0_SCENARIO_DEFINITIONS } from '../scripts/benchmark/p0-electrical-regression.mjs';
import {
    P0_EXT_SCENARIO_DEFINITIONS,
    runAllScenarios,
    runBaselineCli
} from '../scripts/benchmark/p0-electrical-extensions.mjs';

const EXTENSIONS_SCRIPT = resolve(process.cwd(), 'scripts/benchmark/p0-electrical-extensions.mjs');
const BASELINE_FILE = resolve(
    process.cwd(),
    'scripts/benchmark/baselines/p0-electrical-extensions-baseline.json'
);

describe('P0 electrical extension scenarios', () => {
    it('keeps extension ids off the canonical 20 and uses production ticks for AC RMS', () => {
        const ids = P0_EXT_SCENARIO_DEFINITIONS.map((scenario) => scenario.id);
        expect(ids).toEqual([
            'motor_stall',
            'ac_resistor_rms',
            'diode_forward',
            'diode_reverse',
            'switch_closed_6v10',
            'switch_open_6v10'
        ]);
        expect(new Set(ids).size).toBe(ids.length);

        const canonicalIds = new Set(P0_SCENARIO_DEFINITIONS.map((scenario) => scenario.id));
        expect(ids.filter((id) => canonicalIds.has(id))).toEqual([]);

        const ac = P0_EXT_SCENARIO_DEFINITIONS.find((scenario) => scenario.id === 'ac_resistor_rms');
        expect(ac.runner).toBe('production-tick');
        expect(ac.dt).toBe(0.01);
        expect(ac.steps).toBeGreaterThanOrEqual(2);
    });

    it('builds extension nets with geometric wires instead of pre-written nodes', () => {
        for (const def of P0_EXT_SCENARIO_DEFINITIONS) {
            const source = Function.prototype.toString.call(def.build);
            expect(source).toContain('createTestCircuit');
            expect(source).toContain('connectWire');
            expect(source).not.toMatch(/\.nodes\s*=/);
            expect(source).not.toMatch(/\bnodes\s*:/);
            const circuit = def.build();
            expect(circuit.getAllWires().length).toBeGreaterThan(0);
        }
    });

    it('runs extension scenarios with the expected electrical values', () => {
        const snapshots = runAllScenarios();
        expect(snapshots.every((snapshot) => snapshot.valid)).toBe(true);

        const byId = Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot]));

        expect(byId.motor_stall.componentCurrents.M1).toBeCloseTo(1.2, 6);

        expect(byId.switch_closed_6v10.componentCurrents).toHaveProperty('S1');
        expect(byId.switch_closed_6v10.componentCurrents.S1).toBeGreaterThan(0.59);
        expect(byId.switch_closed_6v10.componentCurrents.S1).toBeLessThan(0.61);
        expect(byId.switch_open_6v10.componentCurrents).toHaveProperty('S1');
        expect(Math.abs(byId.switch_open_6v10.componentCurrents.S1)).toBeLessThan(1e-6);

        expect(byId.diode_forward.componentCurrents).toHaveProperty('D1');
        expect(byId.diode_reverse.componentCurrents).toHaveProperty('D1');
        const forward = Math.abs(byId.diode_forward.componentCurrents.D1);
        const reverse = Math.abs(byId.diode_reverse.componentCurrents.D1);
        expect(forward).toBeGreaterThan(0.01);
        expect(reverse).toBeGreaterThan(0);
        expect(reverse).toBeLessThan(1e-9);
        expect(forward).toBeGreaterThan(reverse);

        const ac = byId.ac_resistor_rms;
        expect(ac.runner).toBe('production-tick');
        expect(ac.substepCount).toBe(20);
        expect(ac.sampleCount).toBe(ac.steps * ac.substepCount);
        expect(ac.componentRmsCurrents.R1).toBeCloseTo(1, 2);
        expect(ac.componentRmsVoltages.R1).toBeCloseTo(10, 2);
        expect(ac.componentRmsVoltages.VAC).toBeCloseTo(10, 2);
    });

    it('keeps the AC RMS runner on prepareSimulation/step/haltSimulation without a bare solve', () => {
        const source = readFileSync(EXTENSIONS_SCRIPT, 'utf8');
        const start = source.indexOf('function runProductionTickScenario');
        const end = source.indexOf('function runDcSolveScenario');
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);
        const tickSource = source.slice(start, end);

        expect(tickSource).toContain('prepareSimulation');
        expect(tickSource).toContain('haltSimulation');
        expect(tickSource).toMatch(/\.step\s*\(/);
        expect(tickSource).toContain('solveFrame');
        expect(tickSource).not.toMatch(/solver\.solve\s*\(/);
        expect(tickSource).not.toContain('solver.solve');
    });

    it('fails CLI comparison when a frozen RMS value drifts', () => {
        const dir = mkdtempSync(join(tmpdir(), 'p0-ext-baseline-'));
        const mutatedPath = join(dir, 'baseline.json');
        try {
            const mutated = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
            const ac = mutated.scenarios.find((scenario) => scenario.id === 'ac_resistor_rms');
            ac.componentRmsCurrents.R1 = 99;
            writeFileSync(mutatedPath, `${JSON.stringify(mutated, null, 2)}\n`);
            expect(runBaselineCli({ baselineFile: mutatedPath })).toBe(1);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
