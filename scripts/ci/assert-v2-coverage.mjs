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

function buildNodeIndices(terminalCount) {
    if (terminalCount <= 1) return [1];
    if (terminalCount === 2) return [1, 0];
    if (terminalCount === 3) return [1, 0, 2];
    if (terminalCount === 4) return [1, 0, 2, 3];
    return Array.from({ length: terminalCount }, (_, index) => index + 1);
}

function buildSampleComponent(type, manifest) {
    const terminalCount = Number(manifest?.terminalCount || 2);
    const defaults = manifest?.defaults && typeof manifest.defaults === 'object' ? manifest.defaults : {};
    const nodes = buildNodeIndices(terminalCount);
    const params = { ...defaults };

    if (type === 'Rheostat') {
        params.connectionMode = 'all';
    }
    if (type === 'Relay') {
        params.energized = false;
    }
    if (type === 'SPDTSwitch') {
        params.position = 'a';
    }
    if (type === 'Switch') {
        params.closed = true;
    }
    if (type === 'Ammeter') {
        params.resistance = 1;
    }
    if (type === 'Voltmeter' && params.resistance === Infinity) {
        params.resistance = 1e12;
    }
    if (type === 'Ground') {
        return {
            id: `${type}_1`,
            type,
            nodes,
            params
        };
    }

    return {
        id: `${type}_1`,
        type,
        nodes,
        params
    };
}

function buildSampleNetlist(component) {
    const nodeSet = new Set([0]);
    for (const node of component.nodes || []) {
        if (Number.isInteger(node) && node >= 0) {
            nodeSet.add(node);
        }
    }
    const nodeCount = Math.max(2, ...Array.from(nodeSet)) + 1;
    return {
        meta: { version: 2 },
        nodes: Array.from({ length: nodeCount }, (_, index) => ({ id: String(index) })),
        components: [component]
    };
}

async function main() {
    const manifestModule = await importFromRoot('src/v2/domain/components/ComponentManifest.js');
    const rendererModule = await importFromRoot('src/v2/ui/renderers/RendererRegistryV2.js');
    const solverModule = await importFromRoot('src/v2/simulation/SolveCircuitV2.js');
    const stateModule = await importFromRoot('src/v2/simulation/SimulationStateV2.js');

    const { listComponentTypesV2, getComponentManifestV2 } = manifestModule;
    const { getRendererV2 } = rendererModule;
    const { solveCircuitV2 } = solverModule;
    const { SimulationStateV2 } = stateModule;

    if (typeof listComponentTypesV2 !== 'function') {
        fail('listComponentTypesV2 export is missing');
    }
    if (typeof getRendererV2 !== 'function') {
        fail('getRendererV2 export is missing');
    }
    if (typeof solveCircuitV2 !== 'function') {
        fail('solveCircuitV2 export is missing');
    }

    const componentTypes = listComponentTypesV2();
    if (!Array.isArray(componentTypes) || componentTypes.length === 0) {
        fail('component manifest is empty');
    }

    const missingRenderers = [];
    const unsupportedInSolver = [];

    for (const type of componentTypes) {
        try {
            getRendererV2(type);
        } catch (_) {
            missingRenderers.push(type);
        }

        const manifest = getComponentManifestV2(type);
        const sample = buildSampleComponent(type, manifest);
        const dto = buildSampleNetlist(sample);
        const result = solveCircuitV2(dto, new SimulationStateV2(), { dt: 0.01, simTime: 0 });
        const warnings = Array.isArray(result?.diagnostics?.warnings) ? result.diagnostics.warnings : [];
        const hasUnsupportedWarning = warnings.some((item) =>
            String(item).includes('unsupported component type')
        );
        if (hasUnsupportedWarning) {
            unsupportedInSolver.push(type);
        }
    }

    if (missingRenderers.length > 0) {
        fail(`missing renderer registration for: ${missingRenderers.join(', ')}`);
    }
    if (unsupportedInSolver.length > 0) {
        fail(`solver still reports unsupported component type for: ${unsupportedInSolver.join(', ')}`);
    }

    console.log(`[v2-coverage] ok (${componentTypes.length} component types covered)`);
}

main().catch((error) => {
    fail(error?.stack || error?.message || String(error));
});
