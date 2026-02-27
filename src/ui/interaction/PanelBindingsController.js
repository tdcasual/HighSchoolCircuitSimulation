export function bindButtonEvents() {
    const bindClick = (id, handler) => {
        const element = document.getElementById(id);
        if (!element || typeof element.addEventListener !== 'function') return;
        element.addEventListener('click', handler);
    };

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

    // 清空按钮
    const handleClear = () => {
        if (confirm('确定要清空整个电路吗？')) {
            this.app.clearCircuit();
        }
    };
    bindClick('btn-clear', handleClear);
    bindClick('btn-mobile-clear', handleClear);

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
