/**
 * CircuitSnapshotSkill.js - convert runtime circuit state into model-readable text
 */

export const CircuitSnapshotSkill = {
    name: 'circuit_snapshot',

    run(input = {}, context = {}) {
        const explainer = input.explainer || context.explainer;
        if (!explainer || typeof explainer.extractCircuitState !== 'function') {
            throw new Error('Circuit snapshot skill requires a valid CircuitExplainer');
        }

        const options = {
            concise: input.concise ?? false,
            includeTopology: input.includeTopology ?? true,
            includeNodes: input.includeNodes ?? true
        };

        return explainer.extractCircuitState(options);
    }
};
