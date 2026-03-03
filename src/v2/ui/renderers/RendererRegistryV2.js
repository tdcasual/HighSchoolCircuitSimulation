import {
    renderCapacitorV2,
    renderInductorV2,
    renderResistorV2,
    renderVoltmeterV2
} from './electrical/PassiveRenderers.js';
import { renderPowerSourceV2 } from './electrical/SourceRenderers.js';
import { renderSwitchV2 } from './controls/SwitchRenderers.js';

const RENDERER_MAP_V2 = new Map([
    ['PowerSource', renderPowerSourceV2],
    ['Resistor', renderResistorV2],
    ['Switch', renderSwitchV2],
    ['Capacitor', renderCapacitorV2],
    ['Inductor', renderInductorV2],
    ['Voltmeter', renderVoltmeterV2]
]);

export const TODO_UNMIGRATED_RENDERERS_V2 = Object.freeze([
    'Ground',
    'ACVoltageSource',
    'Diode',
    'LED',
    'Thermistor',
    'Photoresistor',
    'Relay',
    'Rheostat',
    'Bulb',
    'ParallelPlateCapacitor',
    'Motor',
    'SPDTSwitch',
    'Fuse',
    'Ammeter',
    'BlackBox'
]);

export function createRendererRegistryV2() {
    return new Map(RENDERER_MAP_V2);
}

export function getRendererV2(type) {
    const key = String(type || '');
    const renderer = RENDERER_MAP_V2.get(key);
    if (!renderer) {
        throw new Error(`Renderer not registered for component type: ${key}`);
    }
    return renderer;
}
