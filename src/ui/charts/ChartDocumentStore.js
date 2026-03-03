import {
    createDefaultChartWorkspaceState,
    normalizeChartWorkspaceState
} from './ChartWorkspaceState.js';

function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
}

export class ChartDocumentStore {
    constructor(initialState = null) {
        const seed = initialState && typeof initialState === 'object'
            ? initialState
            : createDefaultChartWorkspaceState();
        this.state = normalizeChartWorkspaceState(seed);
    }

    getState() {
        return this.state;
    }

    replace(nextState) {
        this.state = normalizeChartWorkspaceState(nextState || createDefaultChartWorkspaceState());
        return this.state;
    }

    update(mutator) {
        if (typeof mutator !== 'function') return this.state;
        const draft = cloneState(this.state);
        const nextDraft = mutator(draft) || draft;
        this.state = normalizeChartWorkspaceState(nextDraft);
        return this.state;
    }
}
