import {
    renderAmmeterV2,
    renderBulbV2,
    renderCapacitorV2,
    renderDiodeV2,
    renderInductorV2,
    renderLedV2,
    renderParallelPlateCapacitorV2,
    renderPhotoresistorV2,
    renderResistorV2,
    renderThermistorV2,
    renderVoltmeterV2
} from './electrical/PassiveRenderers.js';
import {
    renderACVoltageSourceV2,
    renderBlackBoxV2,
    renderGroundV2,
    renderMotorV2,
    renderPowerSourceV2
} from './electrical/SourceRenderers.js';
import {
    renderFuseV2,
    renderRelayV2,
    renderRheostatV2,
    renderSpdtSwitchV2,
    renderSwitchV2
} from './controls/SwitchRenderers.js';

const RENDERER_MAP_V2 = new Map([
    ['Ground', renderGroundV2],
    ['PowerSource', renderPowerSourceV2],
    ['ACVoltageSource', renderACVoltageSourceV2],
    ['Resistor', renderResistorV2],
    ['Diode', renderDiodeV2],
    ['LED', renderLedV2],
    ['Thermistor', renderThermistorV2],
    ['Photoresistor', renderPhotoresistorV2],
    ['Relay', renderRelayV2],
    ['Rheostat', renderRheostatV2],
    ['Bulb', renderBulbV2],
    ['Capacitor', renderCapacitorV2],
    ['Inductor', renderInductorV2],
    ['ParallelPlateCapacitor', renderParallelPlateCapacitorV2],
    ['Motor', renderMotorV2],
    ['Switch', renderSwitchV2],
    ['SPDTSwitch', renderSpdtSwitchV2],
    ['Fuse', renderFuseV2],
    ['Ammeter', renderAmmeterV2],
    ['Voltmeter', renderVoltmeterV2],
    ['BlackBox', renderBlackBoxV2]
]);

export const TODO_UNMIGRATED_RENDERERS_V2 = Object.freeze([]);

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
