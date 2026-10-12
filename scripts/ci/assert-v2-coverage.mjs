#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function fail(message) {
    console.error(`[v2-coverage] ${message}`);
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

function stubComponent(type) {
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
        energized: false
    };
}

async function main() {
    const registryModule = await importFromRoot('src/core/simulation/ComponentRegistry.js');
    const rendererModule = await importFromRoot('src/components/render/RendererRegistry.js');
    const typesModule = await importFromRoot('src/v2/infra/components/ComponentDefinitionRegistry.js');

    const { DefaultComponentRegistry } = registryModule;
    const { COMPONENT_RENDERER_METHODS } = rendererModule;
    const { listComponentDefinitionTypes } = typesModule;

    if (!DefaultComponentRegistry || typeof DefaultComponentRegistry.get !== 'function') {
        fail('DefaultComponentRegistry is missing');
    }
    if (!COMPONENT_RENDERER_METHODS || typeof COMPONENT_RENDERER_METHODS !== 'object') {
        fail('production RendererRegistry methods are missing');
    }
    if (typeof listComponentDefinitionTypes !== 'function') {
        fail('listComponentDefinitionTypes export is missing');
    }

    const componentTypes = listComponentDefinitionTypes();
    if (!Array.isArray(componentTypes) || componentTypes.length === 0) {
        fail('component definition list is empty');
    }

    const missingHandlers = [];
    const stampFailures = [];
    const missingRenderers = [];

    for (const type of componentTypes) {
        const handler = DefaultComponentRegistry.get(type);
        if (!handler || typeof handler.stamp !== 'function' || typeof handler.current !== 'function') {
            missingHandlers.push(type);
            continue;
        }
        try {
            handler.stamp(stubComponent(type), createRecordingStampContext(), nodesFor(type));
        } catch (error) {
            stampFailures.push(`${type}: ${error?.message || String(error)}`);
        }
        if (!COMPONENT_RENDERER_METHODS[type]) {
            missingRenderers.push(type);
        }
    }

    if (missingHandlers.length > 0) {
        fail(`missing production stamp/current for: ${missingHandlers.join(', ')}`);
    }
    if (stampFailures.length > 0) {
        fail(`stamp threw for: ${stampFailures.join('; ')}`);
    }
    if (missingRenderers.length > 0) {
        fail(`missing production renderer registration for: ${missingRenderers.join(', ')}`);
    }

    console.log(`[v2-coverage] ok (${componentTypes.length} component types covered)`);
}

main().catch((error) => {
    fail(error?.stack || error?.message || String(error));
});
