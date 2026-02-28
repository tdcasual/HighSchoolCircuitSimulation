/**
 * KnowledgeRetrievalSkill.js
 * Fetches relevant teaching knowledge via provider (local now, MCP later).
 */

function extractComponentTypes(circuit) {
    if (!circuit || !(circuit.components instanceof Map)) return [];
    return [...new Set(
        Array.from(circuit.components.values())
            .map(component => component?.type)
            .filter(Boolean)
    )];
}

export const KnowledgeRetrievalSkill = {
    name: 'knowledge_retrieve',

    async run(input = {}, context = {}) {
        const provider = input.provider || context.knowledgeProvider;
        if (!provider || typeof provider.search !== 'function') {
            return [];
        }

        const question = String(input.question || '').trim();
        const circuit = input.circuit || context.circuit || null;
        const componentTypes = Array.isArray(input.componentTypes)
            ? input.componentTypes
            : extractComponentTypes(circuit);
        const limit = Math.max(1, Number.isFinite(Number(input.limit)) ? Number(input.limit) : 3);
        const runtimeDiagnostics = input.runtimeDiagnostics || null;

        return provider.search({
            question,
            componentTypes,
            limit,
            runtimeDiagnostics
        });
    }
};
