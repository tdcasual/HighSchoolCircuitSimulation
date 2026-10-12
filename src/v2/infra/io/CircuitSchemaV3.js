/**
 * @internal experimental
 * Schema source of truth is CircuitSchemaGateway. This file re-exports a v3-shaped
 * API and must not duplicate key tables. Legacy circuit-schema migration is rejected.
 */
import { CircuitSchemaGateway } from '../../../core/io/CircuitSchemaGateway.js';

export function prepareCircuitPayloadV3(payload, _options = {}) {
    return { payload, migration: null };
}

export function validateCircuitV3(payload, _options = {}) {
    return CircuitSchemaGateway.validate(payload);
}
