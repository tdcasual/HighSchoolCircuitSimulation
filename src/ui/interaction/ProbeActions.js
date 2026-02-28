export function renameObservationProbe(probeId, nextLabel = null) {
    const probe = this.circuit.getObservationProbe(probeId);
    if (!probe) return false;

    let resolvedLabel = nextLabel;
    if (resolvedLabel === null && typeof window !== 'undefined' && typeof window.prompt === 'function') {
        const currentLabel = probe.label && String(probe.label).trim() ? String(probe.label).trim() : probe.id;
        resolvedLabel = window.prompt('输入探针名称（留空使用ID）', currentLabel);
    }
    if (resolvedLabel === null) return false;

    const normalized = String(resolvedLabel).trim();
    this.runWithHistory('重命名探针', () => {
        probe.label = normalized || null;
        this.renderer.renderWires();
        this.app.observationPanel?.refreshComponentOptions();
        this.app.observationPanel?.requestRender?.({ onlyIfActive: false });
        this.updateStatus('探针名称已更新');
    });
    return true;
}

export function deleteObservationProbe(probeId) {
    const probe = this.circuit.getObservationProbe(probeId);
    if (!probe) return false;

    this.runWithHistory('删除探针', () => {
        this.circuit.removeObservationProbe(probeId);
        this.renderer.renderWires();
        this.app.observationPanel?.refreshComponentOptions();
        this.app.observationPanel?.requestRender?.({ onlyIfActive: false });
        this.updateStatus('已删除探针');
    });
    return true;
}

export function addProbePlot(probeId) {
    const probe = this.circuit.getObservationProbe(probeId);
    if (!probe) return false;
    const panel = this.app.observationPanel;
    if (!panel || typeof panel.addPlotForSource !== 'function') {
        this.updateStatus('观察面板不可用');
        return false;
    }

    if (typeof this.activateSidePanelTab === 'function' && !this.isObservationTabActive()) {
        this.activateSidePanelTab('observation');
    }
    panel.addPlotForSource(probeId);
    panel.requestRender?.({ onlyIfActive: false });
    this.updateStatus('已添加探针观察图像');
    return true;
}

export function addObservationProbeForWire(wireId, probeType, options = {}) {
    const wire = this.circuit.getWire(wireId);
    if (!wire) return null;

    const labelPrefix = probeType === 'NodeVoltageProbe' ? '节点电压' : '支路电流';
    const typeLabel = probeType === 'NodeVoltageProbe' ? '节点电压探针' : '支路电流探针';
    const autoAddPlot = !!options?.autoAddPlot;
    let createdProbeId = null;

    this.runWithHistory(`添加${typeLabel}`, () => {
        const sameTypeCount = this.circuit.getAllObservationProbes()
            .filter((probe) => probe?.type === probeType).length;
        const probeId = this.circuit.ensureUniqueObservationProbeId(`probe_${Date.now()}`);
        const probe = this.circuit.addObservationProbe({
            id: probeId,
            type: probeType,
            wireId,
            label: `${labelPrefix}${sameTypeCount + 1}`
        });

        if (!probe) {
            this.updateStatus('添加探针失败');
            return;
        }
        createdProbeId = probe.id;

        this.renderer.renderWires();
        const panel = this.app.observationPanel;
        panel?.refreshComponentOptions();
        if (typeof this.activateSidePanelTab === 'function' && !this.isObservationTabActive()) {
            this.activateSidePanelTab('observation');
        }
        if (autoAddPlot && typeof panel?.addPlotForSource === 'function') {
            panel.addPlotForSource(probe.id);
            this.updateStatus(`已添加${typeLabel}并加入观察图像`);
        } else {
            this.updateStatus(`已添加${typeLabel}`);
        }
        panel?.requestRender?.({ onlyIfActive: false });
    });

    return createdProbeId;
}
