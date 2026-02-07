/**
 * Basic circuit JSON validation helper.
 * Throws informative errors when structure is invalid.
 * Used by AI image→JSON pipeline to guard against malformed output.
 */
import { CircuitSchemaGateway } from '../core/io/CircuitSchemaGateway.js';

export function validateCircuitJSON(data) {
    return CircuitSchemaGateway.validate(data);
}
