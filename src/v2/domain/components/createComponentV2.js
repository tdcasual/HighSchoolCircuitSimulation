import { getComponentManifestV2 } from './ComponentManifest.js';

let v2ComponentIdCounter = 0;

function buildDefaultDisplay(type) {
    const display = {
        current: true,
        voltage: false,
        power: false
    };

    if (type === 'Voltmeter') {
        display.current = false;
        display.voltage = true;
    }

    if (type === 'Switch' || type === 'SPDTSwitch' || type === 'Ground' || type === 'BlackBox') {
        display.current = false;
        display.voltage = false;
        display.power = false;
    }

    return display;
}

function buildTerminalExtensions(terminalCount) {
    const extensions = {};
    for (let index = 0; index < terminalCount; index += 1) {
        extensions[index] = { x: 0, y: 0 };
    }
    return extensions;
}

export function resetV2ComponentIdCounter() {
    v2ComponentIdCounter = 0;
}

export function generateComponentIdV2(type) {
    v2ComponentIdCounter += 1;
    return `${type}_${v2ComponentIdCounter}`;
}

export function createComponentV2(type, x = 0, y = 0, existingId = null) {
    const manifest = getComponentManifestV2(type);
    const id = existingId || generateComponentIdV2(type);
    const terminalCount = Number(manifest.terminalCount) || 2;

    return {
        id,
        type: String(type),
        label: null,
        x: Number(x) || 0,
        y: Number(y) || 0,
        rotation: 0,
        nodes: Array.from({ length: terminalCount }, () => -1),
        currentValue: 0,
        voltageValue: 0,
        powerValue: 0,
        display: buildDefaultDisplay(type),
        terminalExtensions: buildTerminalExtensions(terminalCount),
        ...manifest.defaults
    };
}
