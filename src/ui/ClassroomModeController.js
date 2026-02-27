const CLASSROOM_MODE_STORAGE_KEY = 'ui.classroom_mode_level';
const CLASSROOM_MODE_LEGACY_STORAGE_KEY = 'ui.classroom_mode_enabled';
const CLASSROOM_MODE_CLASS = 'classroom-mode';
const CLASSROOM_MODE_ENHANCED_CLASS = 'classroom-mode-enhanced';

const CLASSROOM_LEVEL_OFF = 'off';
const CLASSROOM_LEVEL_STANDARD = 'standard';
const CLASSROOM_LEVEL_ENHANCED = 'enhanced';
const CLASSROOM_LEVELS = Object.freeze([
    CLASSROOM_LEVEL_OFF,
    CLASSROOM_LEVEL_STANDARD,
    CLASSROOM_LEVEL_ENHANCED
]);

function normalizeLevel(value) {
    const text = String(value || '').trim().toLowerCase();
    if (text === CLASSROOM_LEVEL_STANDARD) return CLASSROOM_LEVEL_STANDARD;
    if (text === CLASSROOM_LEVEL_ENHANCED) return CLASSROOM_LEVEL_ENHANCED;
    if (text === 'on' || text === 'true' || text === '1') return CLASSROOM_LEVEL_STANDARD;
    return CLASSROOM_LEVEL_OFF;
}

function readStoredPreference(storageKey) {
    if (typeof localStorage === 'undefined') return CLASSROOM_LEVEL_OFF;
    try {
        const raw = localStorage.getItem(storageKey);
        const normalized = normalizeLevel(raw);
        if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
            return normalized;
        }

        // Backward compatibility: legacy bool storage.
        const legacy = localStorage.getItem(CLASSROOM_MODE_LEGACY_STORAGE_KEY);
        if (legacy === '1' || legacy === 'true') {
            return CLASSROOM_LEVEL_STANDARD;
        }
        return CLASSROOM_LEVEL_OFF;
    } catch (_) {
        return CLASSROOM_LEVEL_OFF;
    }
}

function writeStoredPreference(storageKey, level) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(storageKey, level);
        localStorage.setItem(
            CLASSROOM_MODE_LEGACY_STORAGE_KEY,
            level === CLASSROOM_LEVEL_OFF ? '0' : '1'
        );
    } catch (_) {
        // ignore storage write failures (privacy mode/quota)
    }
}

export class ClassroomModeController {
    constructor(app, options = {}) {
        this.app = app;
        this.storageKey = options.storageKey || CLASSROOM_MODE_STORAGE_KEY;
        this.body = typeof document !== 'undefined' ? document.body : null;
        this.button = typeof document !== 'undefined' ? document.getElementById('btn-classroom-mode') : null;
        this.preferredLevel = CLASSROOM_LEVEL_OFF;
        this.activeLevel = CLASSROOM_LEVEL_OFF;
        this.boundToggle = () => this.toggle();
        this.boundResize = () => this.sync({ persist: false, announce: false });

        this.initialize();
    }

    initialize() {
        this.preferredLevel = readStoredPreference(this.storageKey);
        if (this.button) {
            this.button.addEventListener('click', this.boundToggle);
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.boundResize);
        }
        this.sync({ persist: false, announce: false });
    }

    destroy() {
        if (this.button) {
            this.button.removeEventListener('click', this.boundToggle);
        }
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.boundResize);
        }
    }

    isSupportedViewport() {
        if (typeof window === 'undefined') return true;
        return (window.innerWidth || 0) > 900;
    }

    isOverlayLayout() {
        return !!this.app?.responsiveLayout?.isOverlayMode?.();
    }

    isSupported() {
        return this.isSupportedViewport() && !this.isOverlayLayout();
    }

    updateButton() {
        if (!this.button) return;
        const supported = this.isSupported();
        this.button.hidden = !supported;
        this.button.disabled = !supported;
        this.button.setAttribute('aria-pressed', this.preferredLevel === CLASSROOM_LEVEL_OFF ? 'false' : 'true');
        this.button.setAttribute('data-classroom-level', this.preferredLevel);
        if (this.preferredLevel === CLASSROOM_LEVEL_STANDARD) {
            this.button.textContent = '课堂模式: 标准';
            this.button.title = '课堂模式标准（点击切换到增强）';
            return;
        }
        if (this.preferredLevel === CLASSROOM_LEVEL_ENHANCED) {
            this.button.textContent = '课堂模式: 增强';
            this.button.title = '课堂模式增强（点击关闭）';
            return;
        }
        this.button.textContent = '课堂模式: 关';
        this.button.title = '开启课堂模式（标准）';
    }

    applyBodyClass() {
        if (!this.body?.classList) return;
        this.body.classList.toggle(CLASSROOM_MODE_CLASS, this.activeLevel !== CLASSROOM_LEVEL_OFF);
        this.body.classList.toggle(
            CLASSROOM_MODE_ENHANCED_CLASS,
            this.activeLevel === CLASSROOM_LEVEL_ENHANCED
        );
    }

    resolveNextLevel() {
        const currentIndex = CLASSROOM_LEVELS.indexOf(this.preferredLevel);
        if (currentIndex < 0) return CLASSROOM_LEVEL_STANDARD;
        return CLASSROOM_LEVELS[(currentIndex + 1) % CLASSROOM_LEVELS.length];
    }

    sync(options = {}) {
        const { persist = true, announce = false } = options;
        const supported = this.isSupported();
        this.activeLevel = supported ? this.preferredLevel : CLASSROOM_LEVEL_OFF;
        this.applyBodyClass();
        this.updateButton();

        if (persist) {
            writeStoredPreference(this.storageKey, this.preferredLevel);
        }

        if (announce && this.app?.updateStatus) {
            if (this.preferredLevel !== CLASSROOM_LEVEL_OFF && !supported) {
                this.app.updateStatus('课堂模式在当前分辨率下暂不可用');
                return;
            }
            if (this.preferredLevel === CLASSROOM_LEVEL_STANDARD) {
                this.app.updateStatus('已开启课堂模式（标准）');
                return;
            }
            if (this.preferredLevel === CLASSROOM_LEVEL_ENHANCED) {
                this.app.updateStatus('已开启课堂模式（增强）');
                return;
            }
            this.app.updateStatus('已关闭课堂模式');
        }
    }

    toggle() {
        this.preferredLevel = this.resolveNextLevel();
        this.sync({ persist: true, announce: true });
    }

    setPreferredLevel(level, options = {}) {
        const {
            persist = true,
            announce = false
        } = options;
        this.preferredLevel = normalizeLevel(level);
        this.sync({ persist, announce });
        return {
            preferredLevel: this.preferredLevel,
            activeLevel: this.activeLevel,
            supported: this.isSupported()
        };
    }
}
