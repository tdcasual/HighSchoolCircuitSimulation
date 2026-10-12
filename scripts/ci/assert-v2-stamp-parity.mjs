#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function fail(message) {
    console.error(`[v2-stamp-parity] ${message}`);
    process.exit(1);
}

async function importFromRoot(relPath) {
    const absPath = path.resolve(root, relPath);
    return import(pathToFileURL(absPath).href);
}

function createRecordingStampContext() {
    const calls = [];
    const record = (name) => (...args) => {
        calls.push({ name, args });
    };
    return {
        calls,
        stampResistor: record('stampResistor'),
        stampCurrentSource: record('stampCurrentSource'),
        stampVoltageSource: record('stampVoltageSource'),
        stampSeriesVoltageSource: record('stampSeriesVoltageSource'),
        getSourceInstantVoltage: () => 0,
        voltage: () => 0,
        dt: 0.01,
        nodeCount: 4,
        solveVector: [],
        resolveDynamicIntegrationMethod: () => 'auto',
        state: { get() { return {}; } }
    };
}

function nodesFor(type) {
    const isValidNode = (n) => Number.isInteger(n) && n >= 0;
    if (type === 'SPDTSwitch' || type === 'Rheostat') {
        return { n1: 1, n2: 2, i1: 0, i2: 1, nodeCount: 4, isValidNode };
    }
    if (type === 'Relay') {
        return { n1: 1, n2: 2, i1: 0, i2: 1, nodeCount: 5, isValidNode };
    }
    return { n1: 1, n2: 2, i1: 0, i2: 1, nodeCount: 3, isValidNode };
}

function stubComponent(type, overrides = {}) {
    const nodes = type === 'SPDTSwitch' || type === 'Rheostat'
        ? [1, 2, 3]
        : type === 'Relay'
            ? [1, 2, 3, 4]
            : [1, 2];
    return {
        id: `${type}1`,
        type,
        nodes,
        vsIndex: 0,
        closed: true,
        position: 'a',
        resistance: 5,
        connectionMode: 'all',
        energized: false,
        ...overrides
    };
}

function valuesClose(left, right) {
    if (typeof left === 'number' && typeof right === 'number') {
        if (!Number.isFinite(left) && !Number.isFinite(right)) return true;
        const delta = Math.abs(left - right);
        const scale = Math.max(Math.abs(left), Math.abs(right), 1);
        return delta <= 1e-12 || delta <= 1e-12 * scale;
    }
    return Object.is(left, right);
}

function callsClose(left, right) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
        if (left[i].name !== right[i].name) return false;
        const a = left[i].args;
        const b = right[i].args;
        if (a.length !== b.length) return false;
        for (let j = 0; j < a.length; j += 1) {
            if (!valuesClose(a[j], b[j])) return false;
        }
    }
    return true;
}

function formatCalls(calls) {
    return calls.map((call) => `${call.name}(${call.args.map((arg) => String(arg)).join(', ')})`).join(' | ')
        || '<none>';
}

function recordStamp(registry, type, extra = {}) {
    const handler = registry.get(type);
    if (!handler || typeof handler.stamp !== 'function') {
        throw new Error(`missing stamp handler for ${type}`);
    }
    const context = createRecordingStampContext();
    if (extra.context && typeof extra.context === 'object') {
        Object.assign(context, extra.context);
    }
    handler.stamp(stubComponent(type, extra.overrides || {}), context, nodesFor(type));
    return context.calls;
}

const EXTRA_CASES = Object.freeze([
    { type: 'Ammeter', overrides: { resistance: 0 } },
    { type: 'Ammeter', overrides: { resistance: 1e-12 } },
    { type: 'Switch', overrides: { closed: true, vsIndex: 0 } },
    { type: 'Switch', overrides: { closed: false } },
    { type: 'Rheostat', overrides: { connectionMode: 'slider-only' } },
    { type: 'Rheostat', overrides: { connectionMode: 'none' } },
    { type: 'Motor', overrides: { vsIndex: 0, resistance: 5, backEmf: 0 } },
    { type: 'Motor', overrides: { vsIndex: undefined, resistance: 5 } },
    { type: 'SPDTSwitch', overrides: { position: 'b', vsIndex: 0 } },
    { type: 'PowerSource', overrides: { internalResistance: 1e-9, _nortonModel: true, voltage: 6 } },
    { type: 'PowerSource', overrides: { internalResistance: 0, _nortonModel: false, voltage: 6, vsIndex: 0 } },
    {
        type: 'Capacitor',
        overrides: {
            capacitance: 0.001,
            prevVoltage: 1,
            prevCharge: 0.001,
            prevCurrent: 0.1,
            _dynamicHistoryReady: true
        },
        context: { resolveDynamicIntegrationMethod: () => 'trapezoidal' }
    },
    {
        type: 'Inductor',
        overrides: {
            inductance: 0.1,
            prevCurrent: 1,
            prevVoltage: 0.5,
            _dynamicHistoryReady: true
        },
        context: { resolveDynamicIntegrationMethod: () => 'trapezoidal' }
    }
]);

async function main() {
    const v1Module = await importFromRoot('src/core/simulation/ComponentRegistry.js');
    const v2Module = await importFromRoot('src/v2/simulation/StampRegistryV2.js');
    const typesModule = await importFromRoot('src/v2/infra/components/ComponentDefinitionRegistry.js');

    const { DefaultComponentRegistry } = v1Module;
    const { DefaultStampRegistryV2 } = v2Module;
    const { listComponentDefinitionTypes } = typesModule;

    if (!DefaultComponentRegistry || typeof DefaultComponentRegistry.get !== 'function') {
        fail('DefaultComponentRegistry is missing');
    }
    if (!DefaultStampRegistryV2 || typeof DefaultStampRegistryV2.get !== 'function') {
        fail('DefaultStampRegistryV2 is missing');
    }

    const componentTypes = listComponentDefinitionTypes();
    const mismatches = [];

    for (const type of componentTypes) {
        let v1Calls;
        let v2Calls;
        try {
            v1Calls = recordStamp(DefaultComponentRegistry, type);
            v2Calls = recordStamp(DefaultStampRegistryV2, type);
        } catch (error) {
            mismatches.push(`${type}: ${error?.message || String(error)}`);
            continue;
        }
        if (!callsClose(v1Calls, v2Calls)) {
            mismatches.push(`${type}: v1=${formatCalls(v1Calls)} v2=${formatCalls(v2Calls)}`);
        }
    }

    for (const extra of EXTRA_CASES) {
        const label = `${extra.type}${JSON.stringify(extra.overrides)}`;
        let v1Calls;
        let v2Calls;
        try {
            v1Calls = recordStamp(DefaultComponentRegistry, extra.type, extra);
            v2Calls = recordStamp(DefaultStampRegistryV2, extra.type, extra);
        } catch (error) {
            mismatches.push(`${label}: ${error?.message || String(error)}`);
            continue;
        }
        if (!callsClose(v1Calls, v2Calls)) {
            mismatches.push(`${label}: v1=${formatCalls(v1Calls)} v2=${formatCalls(v2Calls)}`);
        }
    }

    if (mismatches.length > 0) {
        fail(`stamp sequence mismatch:\n- ${mismatches.join('\n- ')}`);
    }

    console.log(`[v2-stamp-parity] ok (${componentTypes.length} types + ${EXTRA_CASES.length} extras)`);
}

main().catch((error) => {
    fail(error?.stack || error?.message || String(error));
});
