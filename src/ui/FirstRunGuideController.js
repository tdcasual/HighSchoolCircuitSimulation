import {
    isFirstRunGuideDismissed,
    setFirstRunGuideDismissed,
    shouldShowFirstRunGuide
} from './interaction/UIStateController.js';

export class FirstRunGuideController {
    constructor(app, options = {}) {
        this.app = app;
        this.enabled = options.enabled !== false;
        this.storage = options.storage;
        this.storageKey = options.storageKey;
        this.overlayId = options.overlayId || 'first-run-guide-overlay';
        this.overlayEl = null;
        this.rememberCheckboxEl = null;
        this.boundOverlayClick = (event) => this.handleOverlayClick(event);

        if (typeof document === 'undefined') return;
        this.ensureOverlay();
        this.showIfNeeded();
    }

    shouldShow() {
        return shouldShowFirstRunGuide({
            enabled: this.enabled,
            storage: this.storage,
            key: this.storageKey
        });
    }

    isDismissed() {
        return isFirstRunGuideDismissed({
            storage: this.storage,
            key: this.storageKey
        });
    }

    setDismissed(dismissed) {
        return setFirstRunGuideDismissed(!!dismissed, {
            storage: this.storage,
            key: this.storageKey
        });
    }

    ensureOverlay() {
        let overlay = document.getElementById(this.overlayId);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = this.overlayId;
            overlay.className = 'first-run-guide-overlay hidden';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = `
                <div class="first-run-guide-card" role="dialog" aria-modal="true" aria-label="快速上手引导">
                    <h3>欢迎使用电路模拟器</h3>
                    <p>建议按这个顺序开始：</p>
                    <ol>
                        <li>从左侧添加电源和电阻，形成闭合回路。</li>
                        <li>点击“开始模拟”查看电流电压变化。</li>
                        <li>在“观察”页快速添加 U-t / I-t 图像。</li>
                    </ol>
                    <label class="first-run-guide-remember">
                        <input type="checkbox" data-guide-action="remember" />
                        不再提示
                    </label>
                    <div class="first-run-guide-actions">
                        <button type="button" class="control-btn" data-guide-action="skip">稍后</button>
                        <button type="button" class="control-btn" data-guide-action="start">开始使用</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        this.overlayEl = overlay;
        this.rememberCheckboxEl = overlay.querySelector('[data-guide-action="remember"]');
        overlay.removeEventListener('click', this.boundOverlayClick);
        overlay.addEventListener('click', this.boundOverlayClick);
    }

    handleOverlayClick(event) {
        const action = event.target?.dataset?.guideAction;
        if (!action) return;
        if (action === 'skip') {
            this.dismiss({ remember: !!this.rememberCheckboxEl?.checked, announce: false });
            return;
        }
        if (action === 'start') {
            this.dismiss({ remember: !!this.rememberCheckboxEl?.checked, announce: true });
        }
    }

    show() {
        if (!this.overlayEl) return false;
        this.overlayEl.classList.remove('hidden');
        this.overlayEl.setAttribute('aria-hidden', 'false');
        return true;
    }

    hide() {
        if (!this.overlayEl) return false;
        this.overlayEl.classList.add('hidden');
        this.overlayEl.setAttribute('aria-hidden', 'true');
        return true;
    }

    dismiss(options = {}) {
        const remember = !!options.remember;
        const announce = options.announce !== false;
        if (remember) {
            this.setDismissed(true);
        }
        this.hide();
        if (announce) {
            this.app?.updateStatus?.('提示：可在观察面板尝试快速预设与模板功能');
        }
    }

    showIfNeeded() {
        if (!this.shouldShow()) return false;
        return this.show();
    }
}

