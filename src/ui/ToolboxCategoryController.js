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

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function safeToggleClass(node, className, force) {
    const toggle = node?.classList?.toggle;
    if (typeof toggle !== 'function') return false;
    try {
        return !!toggle.call(node.classList, className, force);
    } catch (_) {
        return false;
    }
}

function safeSetAttribute(node, name, value) {
    return safeInvokeMethod(node, 'setAttribute', name, value);
}

export class ToolboxCategoryController {
    constructor(app, options = {}) {
        this.app = app;
        this.storageKey = options.storageKey || TOOLBOX_CATEGORY_STORAGE_KEY;
        this.document = typeof document !== 'undefined' ? document : null;
        this.toolbox = this.document?.getElementById?.('toolbox') || null;
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

        const toggleButton = this.ensureToggleButton(category, key, heading);

        if (toggleButton) {
            const clickHandler = (event) => {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                this.toggleCategory(key);
            };
            safeInvokeMethod(toggleButton, 'addEventListener', 'click', clickHandler);
            if (typeof toggleButton?.removeEventListener === 'function') {
                this.boundListeners.push({
                    target: toggleButton,
                    clickHandler
                });
            }

            const headingClickHandler = () => this.toggleCategory(key);
            safeInvokeMethod(heading, 'addEventListener', 'click', headingClickHandler);
            if (typeof heading?.removeEventListener === 'function') {
                this.boundListeners.push({
                    target: heading,
                    clickHandler: headingClickHandler
                });
            }
            return;
        }

        // Fallback for environments without full DOM APIs (tests/mocks).
        safeSetAttribute(heading, 'role', 'button');
        safeSetAttribute(heading, 'tabindex', '0');
        const fallbackClickHandler = () => this.toggleCategory(key);
        const fallbackKeydownHandler = (event) => {
            if (!isToggleKey(event?.key)) return;
            event.preventDefault?.();
            this.toggleCategory(key);
        };
        const canRemove = typeof heading?.removeEventListener === 'function';
        safeInvokeMethod(heading, 'addEventListener', 'click', fallbackClickHandler);
        safeInvokeMethod(heading, 'addEventListener', 'keydown', fallbackKeydownHandler);
        if (canRemove) {
            this.boundListeners.push({
                target: heading,
                clickHandler: fallbackClickHandler,
                keydownHandler: fallbackKeydownHandler
            });
        }
    }

    ensureToggleButton(category, key, heading) {
        if (!this.document?.createElement || typeof category?.insertBefore !== 'function') {
            return null;
        }

        let header = category.querySelector?.('.tool-category-header') || null;
        if (!header) {
            header = this.document.createElement('div');
            header.className = 'tool-category-header';
            category.insertBefore(header, heading);
            header.appendChild?.(heading);
        }

        let button = category.querySelector?.('.tool-category-toggle') || null;
        if (!button) {
            button = this.document.createElement('button');
            button.type = 'button';
            button.className = 'tool-category-toggle';
            button.dataset.category = key;
            header.appendChild?.(button);
        }

        const text = String(heading.textContent || '').trim();
        safeSetAttribute(button, 'aria-label', text ? `切换${text}` : `切换${key}`);
        return button;
    }

    applyState(options = {}) {
        const { persist = true } = options;
        this.categories.forEach((category) => {
            const key = category?.dataset?.category;
            const collapsible = category?.dataset?.collapsible !== 'false';
            const heading = typeof category?.querySelector === 'function' ? category.querySelector('h3') : null;
            const button = typeof category?.querySelector === 'function'
                ? category.querySelector('.tool-category-toggle')
                : null;
            const collapsed = !!this.state[key];

            safeToggleClass(category, 'collapsed', collapsible && collapsed);
            if (heading && collapsible) {
                safeSetAttribute(heading, 'aria-expanded', collapsed ? 'false' : 'true');
            }
            if (button && collapsible) {
                const label = collapsed ? '展开' : '收起';
                button.textContent = label;
                safeSetAttribute(button, 'aria-expanded', collapsed ? 'false' : 'true');
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
        this.boundListeners.forEach(({ target, clickHandler, keydownHandler }) => {
            safeInvokeMethod(target, 'removeEventListener', 'click', clickHandler);
            if (keydownHandler) {
                safeInvokeMethod(target, 'removeEventListener', 'keydown', keydownHandler);
            }
        });
        this.boundListeners = [];
    }
}
