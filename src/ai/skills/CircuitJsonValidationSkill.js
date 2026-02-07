/**
 * CircuitJsonValidationSkill.js - schema guard for generated circuit JSON
 */

import { validateCircuitJSON } from '../../utils/circuitSchema.js';
import { Circuit } from '../../engine/Circuit.js';

function runElectricalCheck(input) {
    const scratch = new Circuit();
    scratch.fromJSON(input);
    scratch.ensureSolverPrepared();
    const result = scratch.solver.solve(scratch.dt, scratch.simTime || 0);
    if (!result || result.valid !== true) {
        throw new Error('电路求解失败（拓扑或参数无效）');
    }
}

export const CircuitJsonValidationSkill = {
    name: 'circuit_json_validate',

    run(input = {}, context = {}) {
        validateCircuitJSON(input);
        if (context?.skipElectricalCheck !== true) {
            runElectricalCheck(input);
        }
        return input;
    }
};
