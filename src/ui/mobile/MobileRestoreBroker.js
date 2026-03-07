function normalizeCandidate(candidate = {}, sequence = 0) {
    const id = String(candidate.id || '').trim();
    if (!id) return null;
    return {
        id,
        source: String(candidate.source || 'unknown'),
        label: String(candidate.label || '').trim(),
        priority: Number(candidate.priority) || 0,
        action: candidate.action && typeof candidate.action === 'object'
            ? { ...candidate.action }
            : { type: 'focus-canvas' },
        sequence
    };
}

function selectCurrentCandidate(candidates) {
    let selected = null;
    for (const candidate of candidates.values()) {
        if (!selected) {
            selected = candidate;
            continue;
        }
        if (candidate.priority > selected.priority) {
            selected = candidate;
            continue;
        }
        if (candidate.priority === selected.priority && candidate.sequence > selected.sequence) {
            selected = candidate;
        }
    }
    return selected;
}

export class MobileRestoreBroker {
    constructor() {
        this.candidates = new Map();
        this.listeners = new Set();
        this.sequence = 0;
        this.currentId = null;
    }

    register(candidate = {}) {
        const normalized = normalizeCandidate(candidate, ++this.sequence);
        if (!normalized) return false;
        this.candidates.set(normalized.id, normalized);
        this.syncCurrent();
        return true;
    }

    clear(idOrSource) {
        const key = String(idOrSource || '').trim();
        if (!key) return false;
        let changed = false;
        for (const [id, candidate] of this.candidates.entries()) {
            if (id === key || candidate.source === key) {
                this.candidates.delete(id);
                changed = true;
            }
        }
        if (changed) {
            this.syncCurrent();
        }
        return changed;
    }

    getCurrent() {
        if (!this.currentId) return null;
        return this.candidates.get(this.currentId) || null;
    }

    subscribe(listener) {
        if (typeof listener !== 'function') {
            return () => {};
        }
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    syncCurrent() {
        const next = selectCurrentCandidate(this.candidates);
        const nextId = next?.id || null;
        if (nextId === this.currentId) {
            return;
        }
        this.currentId = nextId;
        const current = this.getCurrent();
        this.listeners.forEach((listener) => {
            try {
                listener(current);
            } catch (_) {}
        });
    }
}
