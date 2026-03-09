export function resolveCircuitSourceVoltageAtTime(comp, simTime = 0) {
    if (!comp) return 0;
    if (comp.type === 'ACVoltageSource') {
        const rms = Number.isFinite(comp.rmsVoltage) ? comp.rmsVoltage : 0;
        const frequency = Number.isFinite(comp.frequency) ? comp.frequency : 0;
        const phaseDeg = Number.isFinite(comp.phase) ? comp.phase : 0;
        const offset = Number.isFinite(comp.offset) ? comp.offset : 0;
        const omega = 2 * Math.PI * frequency;
        const phaseRad = phaseDeg * Math.PI / 180;
        return offset + (rms * Math.sqrt(2)) * Math.sin(omega * simTime + phaseRad);
    }
    return Number.isFinite(comp.voltage) ? comp.voltage : 0;
}

export function assignCircuitSourceInstantaneousVoltage(comp, simTime = 0) {
    const value = resolveCircuitSourceVoltageAtTime(comp, simTime);
    if (comp && typeof comp === 'object') {
        comp.instantaneousVoltage = value;
    }
    return value;
}
