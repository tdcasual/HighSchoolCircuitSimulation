import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    P0_EXT_SCENARIO_DEFINITIONS,
    runAllScenarios
} from '../scripts/benchmark/p0-electrical-extensions.mjs';

const EXTENSIONS_SCRIPT = resolve(process.cwd(), 'scripts/benchmark/p0-electrical-extensions.mjs');

function extractFunctionSource(source, name) {
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const brace = source.indexOf('{', start);
    expect(brace).toBeGreaterThan(start);
    let depth = 0;
    for (let index = brace; index < source.length; index += 1) {
        const ch = source[index];
        if (ch === '{') depth += 1;
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(start, index + 1);
            }
        }
    }
    throw new Error(`Unterminated function ${name}`);
}

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

        const ac = P0_EXT_SCENARIO_DEFINITIONS.find((scenario) => scenario.id === 'ac_resistor_rms');
        expect(ac.runner).toBe('production-tick');
        expect(ac.dt).toBe(0.01);
        expect(ac.steps).toBeGreaterThanOrEqual(2);
    });

    it('runs extension scenarios with the expected electrical values', () => {
        const snapshots = runAllScenarios();
        expect(snapshots.every((snapshot) => snapshot.valid)).toBe(true);

        const byId = Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot]));

        expect(byId.motor_stall.componentCurrents.M1).toBeCloseTo(1.2, 6);

        expect(byId.switch_closed_6v10.componentCurrents.S1).toBeGreaterThan(0.59);
        expect(byId.switch_closed_6v10.componentCurrents.S1).toBeLessThan(0.61);
        expect(Math.abs(byId.switch_open_6v10.componentCurrents.S1 || 0)).toBeLessThan(1e-6);

        const forward = Math.abs(byId.diode_forward.componentCurrents.D1 || 0);
        const reverse = Math.abs(byId.diode_reverse.componentCurrents.D1 || 0);
        expect(forward).toBeGreaterThan(0.01);
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
        const tickSource = extractFunctionSource(source, 'runProductionTickScenario');

        expect(tickSource).toContain('prepareSimulation');
        expect(tickSource).toContain('haltSimulation');
        expect(tickSource).toMatch(/\.step\s*\(/);
        expect(tickSource).not.toMatch(/\.solve\s*\(/);
        expect(tickSource).not.toContain('solver.solve');
    });
});
