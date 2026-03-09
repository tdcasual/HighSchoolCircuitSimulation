import { Matrix } from './Matrix.js';

const IDEAL_SOURCE_RESISTANCE_EPS = 1e-9;

export class SolverMatrixAssembler {
    setLogger(logger) {
        this.logger = logger || null;
    }

    prepareComponents({ components = [], logger = this.logger } = {}) {
        let voltageSourceCount = 0;
        let shortCircuitDetected = false;
        let hasConnectedSwitch = false;
        const isValidNode = (nodeIdx) => nodeIdx !== undefined && nodeIdx !== null && nodeIdx >= 0;

        for (const comp of components) {
            if (!comp || typeof comp !== 'object') continue;

            comp.vsIndex = undefined;
            const isPowerSource = comp.type === 'PowerSource' || comp.type === 'ACVoltageSource';
            if (comp.type === 'Ground') {
                comp._isShorted = false;
                continue;
            }
            if (comp.nodes && comp.nodes.length >= 2) {
                const n1 = comp.nodes[0];
                const n2 = comp.type === 'SPDTSwitch'
                    ? comp.nodes[comp.position === 'b' ? 2 : 1]
                    : comp.nodes[1];
                comp._isShorted = (n1 === n2 && n1 >= 0);
                if (comp.type === 'Relay') {
                    comp._isShorted = false;
                }
                if (comp.type === 'Rheostat') {
                    comp._isShorted = false;
                }

                if (comp._isShorted && isPowerSource) {
                    shortCircuitDetected = true;
                    logger?.warn?.(`Power source ${comp.id} is short-circuited!`);
                }
            } else {
                comp._isShorted = false;
            }

            if (isPowerSource) {
                const internalResistance = Number(comp.internalResistance);
                comp.internalResistance = Number.isFinite(internalResistance) && internalResistance >= 0
                    ? internalResistance
                    : 0.5;
                comp._nortonModel = comp.internalResistance >= IDEAL_SOURCE_RESISTANCE_EPS;
            }
        }

        for (const comp of components) {
            if (!comp || typeof comp !== 'object') continue;

            if (comp.type === 'PowerSource' || comp.type === 'ACVoltageSource') {
                const n1 = comp.nodes?.[0];
                const n2 = comp.nodes?.[1];
                if (!(Number.isFinite(comp.internalResistance) && comp.internalResistance >= IDEAL_SOURCE_RESISTANCE_EPS)) {
                    if (!comp._isShorted) {
                        if (isValidNode(n1) && isValidNode(n2)) {
                            comp.vsIndex = voltageSourceCount++;
                        }
                    }
                }
            } else if (comp.type === 'Motor') {
                if (!comp._isShorted) {
                    const n1 = comp.nodes?.[0];
                    const n2 = comp.nodes?.[1];
                    if (isValidNode(n1) && isValidNode(n2)) {
                        comp.vsIndex = voltageSourceCount++;
                    }
                }
            } else if (comp.type === 'Ammeter') {
                const ammeterResistance = Number(comp.resistance);
                comp.resistance = Number.isFinite(ammeterResistance) && ammeterResistance >= 0
                    ? ammeterResistance
                    : 0;
                if (comp.resistance <= 0) {
                    if (!comp._isShorted) {
                        const n1 = comp.nodes?.[0];
                        const n2 = comp.nodes?.[1];
                        if (isValidNode(n1) && isValidNode(n2)) {
                            comp.vsIndex = voltageSourceCount++;
                        }
                    }
                }
            }

            if (comp.type === 'Inductor' && !Number.isFinite(comp.prevCurrent)) {
                comp.prevCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
            }
            if (comp.type === 'Inductor' && !Number.isFinite(comp.prevVoltage)) {
                comp.prevVoltage = 0;
            }
            if ((comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') && !Number.isFinite(comp.prevCurrent)) {
                comp.prevCurrent = 0;
            }
            if ((comp.type === 'Capacitor' || comp.type === 'ParallelPlateCapacitor') && !Number.isFinite(comp.prevVoltage)) {
                comp.prevVoltage = 0;
            }
            if (comp.type === 'Diode' || comp.type === 'LED') {
                const defaultVf = comp.type === 'LED' ? 2.0 : 0.7;
                const defaultRon = comp.type === 'LED' ? 2 : 1;
                comp.forwardVoltage = Number.isFinite(comp.forwardVoltage) ? comp.forwardVoltage : defaultVf;
                comp.onResistance = Number.isFinite(comp.onResistance) ? comp.onResistance : defaultRon;
                comp.offResistance = Number.isFinite(comp.offResistance) ? comp.offResistance : 1e9;
                comp.conducting = !!comp.conducting;
            }
            if (comp.type === 'Thermistor') {
                comp.resistanceAt25 = Number.isFinite(comp.resistanceAt25) ? comp.resistanceAt25 : 1000;
                comp.beta = Number.isFinite(comp.beta) ? comp.beta : 3950;
                comp.temperatureC = Number.isFinite(comp.temperatureC) ? comp.temperatureC : 25;
            }
            if (comp.type === 'Photoresistor') {
                comp.resistanceDark = Number.isFinite(comp.resistanceDark) ? comp.resistanceDark : 100000;
                comp.resistanceLight = Number.isFinite(comp.resistanceLight) ? comp.resistanceLight : 500;
                comp.lightLevel = Number.isFinite(comp.lightLevel) ? comp.lightLevel : 0.5;
            }
            if (comp.type === 'Relay') {
                comp.coilResistance = Number.isFinite(comp.coilResistance) ? comp.coilResistance : 200;
                comp.pullInCurrent = Number.isFinite(comp.pullInCurrent) ? comp.pullInCurrent : 0.02;
                comp.dropOutCurrent = Number.isFinite(comp.dropOutCurrent) ? comp.dropOutCurrent : 0.01;
                comp.contactOnResistance = Number.isFinite(comp.contactOnResistance) ? comp.contactOnResistance : 1e-3;
                comp.contactOffResistance = Number.isFinite(comp.contactOffResistance) ? comp.contactOffResistance : 1e12;
                comp.energized = !!comp.energized;
            }
            if (comp.type === 'Switch' || comp.type === 'SPDTSwitch') {
                const n1 = comp.nodes?.[0];
                const n2 = comp.type === 'SPDTSwitch'
                    ? comp.nodes?.[comp.position === 'b' ? 2 : 1]
                    : comp.nodes?.[1];
                if (isValidNode(n1) && isValidNode(n2)) {
                    hasConnectedSwitch = true;
                }
            }
        }

        return {
            voltageSourceCount,
            shortCircuitDetected,
            hasConnectedSwitch
        };
    }

    assemble({
        components = [],
        nodeCount = 0,
        voltageSourceCount = 0,
        gmin = 0,
        debugMode = false,
        logger = this.logger,
        stampComponent = null
    } = {}) {
        const size = Math.max(0, nodeCount - 1 + voltageSourceCount);
        const A = Matrix.zeros(size, size);
        const z = Matrix.zeroVector(size);

        for (const comp of components) {
            stampComponent?.(comp, A, z, nodeCount);
        }

        if (gmin > 0) {
            for (let i = 0; i < nodeCount - 1; i++) {
                A[i][i] += gmin;
            }
        }

        if (debugMode) {
            logger?.debug?.('MNA Matrix A:');
            for (let i = 0; i < size; i++) {
                logger?.debug?.(`  [${A[i].map(v => v.toFixed(4)).join(', ')}]`);
            }
            logger?.debug?.('Vector z:', z.map(v => v.toFixed(4)));
        }

        return { A, z, size };
    }

    stampResistor(A, i1, i2, resistance) {
        let normalizedResistance = resistance;
        if (normalizedResistance <= 0) normalizedResistance = 1e-9;
        const conductance = 1 / normalizedResistance;

        if (i1 >= 0) A[i1][i1] += conductance;
        if (i2 >= 0) A[i2][i2] += conductance;
        if (i1 >= 0 && i2 >= 0) {
            A[i1][i2] -= conductance;
            A[i2][i1] -= conductance;
        }
    }

    stampCurrentSource(z, iFrom, iTo, current) {
        if (!Number.isFinite(current) || Math.abs(current) < 1e-18) return;
        if (iFrom >= 0) z[iFrom] -= current;
        if (iTo >= 0) z[iTo] += current;
    }

    stampVoltageSource(A, z, i1, i2, voltage, vsIndex, nodeCount, logger = this.logger) {
        if (!Number.isInteger(vsIndex) || vsIndex < 0) {
            logger?.warn?.('Skip voltage source stamp due to invalid vsIndex');
            return;
        }
        const equationRow = nodeCount - 1 + vsIndex;
        if (equationRow < 0 || equationRow >= A.length || !A[equationRow]) {
            logger?.warn?.('Skip voltage source stamp due to out-of-range equation row');
            return;
        }

        if (i1 >= 0) A[equationRow][i1] = 1;
        if (i2 >= 0) A[equationRow][i2] = -1;
        if (i1 >= 0) A[i1][equationRow] = 1;
        if (i2 >= 0) A[i2][equationRow] = -1;
        z[equationRow] = voltage;
    }
}
