const TOOLBOX_CATEGORY_STORAGE_KEY = 'ui.toolbox_category_collapsed_v1';

function readStoredState(storageKey) {
    if (typeof localStorage === 'undefined') return {};
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const normalized = {};
        Object.entries(parsed).forEach(([key, value]) => {
            if (!key) return;
            normalized[key] = value === true;
        });
        return normalized;
    } catch (_) {
        return {};
    }
}

function writeStoredState(storageKey, state) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (_) {
        // Ignore storage write failures.
    }
}

function isToggleKey(key) {
    return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

export class ToolboxCategoryController {
    constructor(app, options = {}) {
        this.app = app;
        this.storageKey = options.storageKey || TOOLBOX_CATEGORY_STORAGE_KEY;
        this.toolbox = typeof document !== 'undefined' ? document.getElementById('toolbox') : null;
        this.state = readStoredState(this.storageKey);
        this.boundListeners = [];
        this.categories = [];
        this.initialize();
    }

    initialize() {
        if (!this.toolbox || typeof this.toolbox.querySelectorAll !== 'function') return;
        this.categories = Array.from(this.toolbox.querySelectorAll('.tool-category[data-category]'));
        this.categories.forEach((category) => this.setupCategory(category));
        this.applyState({ persist: false });
    }

    setupCategory(category) {
        const key = category?.dataset?.category;
        const collapsible = category?.dataset?.collapsible !== 'false';
        const heading = typeof category?.querySelector === 'function' ? category.querySelector('h3') : null;
        if (!key || !heading) return;

        if (!collapsible) {
            heading.removeAttribute?.('role');
            heading.removeAttribute?.('tabindex');
            heading.removeAttribute?.('aria-expanded');
            return;
        }

        heading.setAttribute('role', 'button');
        heading.setAttribute('tabindex', '0');

        const clickHandler = () => this.toggleCategory(key);
        const keydownHandler = (event) => {
            if (!isToggleKey(event?.key)) return;
            event.preventDefault?.();
            this.toggleCategory(key);
        };
        heading.addEventListener('click', clickHandler);
        heading.addEventListener('keydown', keydownHandler);

        this.boundListeners.push({
            heading,
            clickHandler,
            keydownHandler
        });
    }

    applyState(options = {}) {
        const { persist = true } = options;
        this.categories.forEach((category) => {
            const key = category?.dataset?.category;
            const collapsible = category?.dataset?.collapsible !== 'false';
            const heading = typeof category?.querySelector === 'function' ? category.querySelector('h3') : null;
            const collapsed = !!this.state[key];

            category.classList.toggle('collapsed', collapsible && collapsed);
            if (heading && collapsible) {
                heading.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            }
        });

        if (persist) {
            writeStoredState(this.storageKey, this.state);
        }
    }

    toggleCategory(key) {
        if (!key) return;
        this.state[key] = !this.state[key];
        this.applyState({ persist: true });
    }

    destroy() {
        this.boundListeners.forEach(({ heading, clickHandler, keydownHandler }) => {
            heading.removeEventListener('click', clickHandler);
            heading.removeEventListener('keydown', keydownHandler);
        });
        this.boundListeners = [];
    }
}
