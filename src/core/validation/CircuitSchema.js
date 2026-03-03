import { CircuitSchemaGateway } from '../io/CircuitSchemaGateway.js';

export function validateCircuitJSON(data) {
    return CircuitSchemaGateway.validate(data);
}
