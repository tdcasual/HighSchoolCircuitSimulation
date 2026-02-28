export function bindButtonEvents() {
    const CLEAR_HOLD_DURATION_MS = 350;
    const CLEAR_HOLD_MOVE_TOLERANCE_SQ = 64;
    const CLEAR_CONFIRM_MESSAGE = '确定要清空整个电路吗？';
    const CLEAR_HOLD_STATUS_TEXT = '长按“清空电路”以避免误触';

    const bindClick = (id, handler) => {
        const element = document.getElementById(id);
        if (!element || typeof element.addEventListener !== 'function') return;
        element.addEventListener('click', handler);
    };

    const isTouchPointer = (pointerType) => pointerType === 'touch' || pointerType === 'pen';

    // 运行按钮
    const handleRun = () => {
        this.app.startSimulation();
    };
    bindClick('btn-run', handleRun);
    bindClick('btn-mobile-run', handleRun);

    // 停止按钮
    const handleStop = () => {
        this.app.stopSimulation();
    };
    bindClick('btn-stop', handleStop);
    bindClick('btn-mobile-stop', handleStop);

    // 手机端模拟切换按钮
    const handleMobileSimToggle = () => {
        const running = !!this.app?.circuit?.isRunning;
        if (running) {
            this.app.stopSimulation();
        } else {
            this.app.startSimulation();
        }
    };
    bindClick('btn-mobile-sim-toggle', handleMobileSimToggle);

    // 手机端交互模式切换（选择 / 布线）
    const handleMobileModeSelect = () => {
        this.setMobileInteractionMode?.('select');
    };
    const handleMobileModeWire = () => {
        this.setMobileInteractionMode?.('wire');
    };
    bindClick('btn-mobile-mode-select', handleMobileModeSelect);
    bindClick('btn-mobile-mode-wire', handleMobileModeWire);
    bindClick('btn-mobile-endpoint-bridge-mode', () => {
        this.cycleEndpointAutoBridgeMode?.();
    });

    // 清空按钮
    const clearCircuitWithConfirm = () => {
        if (confirm(CLEAR_CONFIRM_MESSAGE)) {
            this.app.clearCircuit();
        }
    };
    const bindDangerousClearButton = (id) => {
        const element = document.getElementById(id);
        if (!element || typeof element.addEventListener !== 'function') return;

        let holdTimer = null;
        let activePointerId = null;
        let startX = 0;
        let startY = 0;
        let holdTriggered = false;
        let suppressNextClick = false;

        const clearHoldTimer = () => {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        };

        const removeHoldStyle = () => {
            if (typeof element.classList?.remove === 'function') {
                element.classList.remove('danger-hold-armed');
            }
        };

        const resetHoldState = () => {
            clearHoldTimer();
            activePointerId = null;
            holdTriggered = false;
            removeHoldStyle();
        };

        const releasePointerCaptureSafely = (pointerId) => {
            if (!Number.isFinite(pointerId)) return;
            if (typeof element.releasePointerCapture !== 'function') return;
            try {
                element.releasePointerCapture(pointerId);
            } catch (_) {}
        };

        const shouldHandlePointer = (event) => {
            const pointerId = Number.isFinite(event?.pointerId) ? Number(event.pointerId) : null;
            if (activePointerId === null || pointerId === null) return true;
            return pointerId === activePointerId;
        };

        element.addEventListener('pointerdown', (event) => {
            if (!isTouchPointer(event?.pointerType)) return;
            if (Number.isFinite(event?.button) && event.button !== 0) return;

            resetHoldState();
            suppressNextClick = false;
            activePointerId = Number.isFinite(event?.pointerId) ? Number(event.pointerId) : null;
            startX = Number(event?.clientX) || 0;
            startY = Number(event?.clientY) || 0;

            if (typeof element.classList?.add === 'function') {
                element.classList.add('danger-hold-armed');
            }
            this.updateStatus?.('继续按住可清空电路');

            holdTimer = setTimeout(() => {
                holdTimer = null;
                holdTriggered = true;
                suppressNextClick = true;
                removeHoldStyle();
                this.app.clearCircuit();
            }, CLEAR_HOLD_DURATION_MS);

            if (Number.isFinite(activePointerId) && typeof element.setPointerCapture === 'function') {
                try {
                    element.setPointerCapture(activePointerId);
                } catch (_) {}
            }
        });

        element.addEventListener('pointermove', (event) => {
            if (!shouldHandlePointer(event)) return;
            if (!holdTimer || holdTriggered) return;

            const dx = (Number(event?.clientX) || 0) - startX;
            const dy = (Number(event?.clientY) || 0) - startY;
            if (dx * dx + dy * dy <= CLEAR_HOLD_MOVE_TOLERANCE_SQ) return;

            const pointerId = activePointerId;
            resetHoldState();
            suppressNextClick = true;
            this.updateStatus?.(CLEAR_HOLD_STATUS_TEXT);
            releasePointerCaptureSafely(pointerId);
        });

        const endHoldGesture = (event) => {
            if (!shouldHandlePointer(event)) return;
            const pointerId = activePointerId;
            const hadPendingHold = !!holdTimer;
            const wasHoldTriggered = holdTriggered;
            resetHoldState();
            releasePointerCaptureSafely(pointerId);
            if (!wasHoldTriggered && hadPendingHold) {
                suppressNextClick = true;
                this.updateStatus?.(CLEAR_HOLD_STATUS_TEXT);
            }
        };

        element.addEventListener('pointerup', endHoldGesture);
        element.addEventListener('pointercancel', endHoldGesture);

        element.addEventListener('click', (event) => {
            if (suppressNextClick) {
                suppressNextClick = false;
                event?.preventDefault?.();
                return;
            }
            clearCircuitWithConfirm();
        });
    };
    bindDangerousClearButton('btn-clear');
    bindDangerousClearButton('btn-mobile-clear');

    // 导出按钮
    const handleExport = () => {
        this.app.exportCircuit();
    };
    bindClick('btn-export', handleExport);
    bindClick('btn-mobile-export', handleExport);

    // 导入按钮
    const handleImport = () => {
        const fileImport = document.getElementById('file-import');
        fileImport?.click?.();
    };
    bindClick('btn-import', handleImport);
    bindClick('btn-mobile-import', handleImport);

    // 习题板（复用原按钮绑定，避免重复切换）
    bindClick('btn-mobile-exercise-board', () => {
        document.getElementById('btn-exercise-board')?.click?.();
    });

    // 文件选择
    document.getElementById('file-import').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            this.app.importCircuit(file);
        }
        e.target.value = '';
    });

    // 对话框按钮
    bindClick('dialog-cancel', () => {
        this.hideDialog();
    });

    bindClick('dialog-ok', () => {
        this.applyDialogChanges();
    });

    // 点击遮罩关闭对话框
    document.getElementById('dialog-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'dialog-overlay') {
            this.hideDialog();
        }
    });

    this.restoreEndpointAutoBridgeMode?.({ silentStatus: true });
    this.syncMobileModeButtons?.();
}

export function bindSidePanelEvents() {
    const tabButtons = Array.from(document.querySelectorAll('.panel-tab-btn'));
    const pages = Array.from(document.querySelectorAll('.panel-page'));
    if (tabButtons.length === 0 || pages.length === 0) return;

    const activate = (panelName) => {
        tabButtons.forEach((btn) => {
            const isActive = btn.dataset.panel === panelName;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        pages.forEach((page) => {
            const isActive = page.dataset.panel === panelName;
            page.classList.toggle('active', isActive);
            if (page.id === 'panel-observation') {
                page.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            }
        });
    };

    tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const panelName = btn.dataset.panel;
            if (panelName) activate(panelName);
        });
    });

    // 暴露给其他逻辑使用（选择元件时自动跳回属性页）
    this.activateSidePanelTab = activate;
}
