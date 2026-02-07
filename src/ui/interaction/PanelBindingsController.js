export function bindButtonEvents() {
    // 运行按钮
    document.getElementById('btn-run').addEventListener('click', () => {
        this.app.startSimulation();
    });

    // 停止按钮
    document.getElementById('btn-stop').addEventListener('click', () => {
        this.app.stopSimulation();
    });

    // 清空按钮
    document.getElementById('btn-clear').addEventListener('click', () => {
        if (confirm('确定要清空整个电路吗？')) {
            this.app.clearCircuit();
        }
    });

    // 导出按钮
    document.getElementById('btn-export').addEventListener('click', () => {
        this.app.exportCircuit();
    });

    // 导入按钮
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('file-import').click();
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
    document.getElementById('dialog-cancel').addEventListener('click', () => {
        this.hideDialog();
    });

    document.getElementById('dialog-ok').addEventListener('click', () => {
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
