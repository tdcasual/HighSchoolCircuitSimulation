import { createElement } from '../../utils/SafeDOM.js';

function safeDocument() {
    return typeof document !== 'undefined' ? document : null;
}

function safeGetElementById(id) {
    const doc = safeDocument();
    if (!doc || typeof doc.getElementById !== 'function') return null;
    try {
        return doc.getElementById(id);
    } catch (_) {
        return null;
    }
}

function safeClearContainer(target) {
    if (!target) return;
    if (typeof target.innerHTML === 'string') {
        try {
            target.innerHTML = '';
            return;
        } catch (_) {
            // continue
        }
    }
    if (Array.isArray(target.children)) {
        target.children.length = 0;
    }
    while (target?.firstChild && typeof target.removeChild === 'function') {
        try {
            target.removeChild(target.firstChild);
        } catch (_) {
            break;
        }
    }
}

function resolveTarget(context, scope, options = {}) {
    if (options.target) return options.target;
    if (scope === 'quick-action') {
        return context?.quickActionBar || null;
    }
    if (scope === 'property-panel' || scope === 'selection-panel') {
        return safeGetElementById('property-content');
    }
    return null;
}

function renderInlineHint(target, message, scope) {
    if (!target || typeof target.appendChild !== 'function') return false;
    safeClearContainer(target);
    const hint = createElement('p', {
        className: `hint local-feedback local-feedback-${scope}`,
        textContent: message
    });
    if (hint.dataset) {
        hint.dataset.feedbackScope = scope;
    }
    target.appendChild(hint);
    return true;
}

export class LocalFeedbackPresenter {
    constructor(context = {}) {
        this.context = context;
    }

    show(message, options = {}) {
        const text = String(message || '').trim();
        if (!text) return false;
        const scope = String(options.scope || 'inline').trim() || 'inline';
        const target = resolveTarget(this.context, scope, options);
        if (!target) return false;

        if (scope === 'quick-action' && typeof target.showHint === 'function') {
            target.showHint(text, Number.isFinite(options.durationMs) ? options.durationMs : 2200);
            return true;
        }

        return renderInlineHint(target, text, scope);
    }
}
