/**
 * CircuitJsonValidationSkill.js - schema guard for generated circuit JSON
 */

import { validateCircuitJSON } from '../../utils/circuitSchema.js';

export const CircuitJsonValidationSkill = {
    name: 'circuit_json_validate',

    run(input = {}) {
        validateCircuitJSON(input);
        return input;
    }
};
