import { CircuitSchemaGateway } from '../core/io/CircuitSchemaGateway.js';

export function validateCircuitJSON(data) {
    return CircuitSchemaGateway.validate(data);
}
