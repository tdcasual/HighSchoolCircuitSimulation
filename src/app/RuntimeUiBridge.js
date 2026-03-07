import { resolveRuntimeDiagnosticsForUpdate } from './RuntimeDiagnosticsPipeline.js';
import { setSimulationControlsRunning, setStatusText } from './SimulationUiState.js';

function getPrimaryRuntimeHint(runtimeDiagnostics = {}) {
    const hints = Array.isArray(runtimeDiagnostics?.hints) ? runtimeDiagnostics.hints : [];
    const primaryHint = hints.find((hint) => typeof hint === 'string' && hint.trim());
    return primaryHint ? primaryHint.trim() : '';
}

function buildRuntimeDiagnosticsStatusMessage(runtimeDiagnostics = {}) {
    const summary = typeof runtimeDiagnostics?.summary === 'string'
        ? runtimeDiagnostics.summary.trim()
        : '';
    const primaryHint = getPrimaryRuntimeHint(runtimeDiagnostics);

    if (summary && primaryHint && !summary.includes(primaryHint)) {
        return `${summary} 建议：${primaryHint}`;
    }
    return summary || primaryHint;
}

export class RuntimeUiBridge {
    constructor(app, options = {}) {
        this.app = app;
        this.setStatusTextImpl = options.setStatusTextImpl || setStatusText;
        this.setSimulationControlsRunningImpl = options.setSimulationControlsRunningImpl || setSimulationControlsRunning;
    }

    updateStatus(text) {
        if (typeof this.app?.updateStatus === 'function' && this.app?.runtimeUiBridge !== this) {
            this.app.updateStatus(text);
            return;
        }
        this.setStatusTextImpl(text);
    }

    onCircuitUpdate(results) {
        const runtimeDiagnostics = resolveRuntimeDiagnosticsForUpdate({
            results,
            circuit: this.app?.circuit
        });

        this.app?.renderer?.updateValues?.();
        this.app?.renderer?.updateWireAnimations?.(this.app?.circuit?.isRunning, results);
        this.app?.chartWorkspace?.onCircuitUpdate?.(results);

        if (runtimeDiagnostics.summary) {
            const shouldShow = !results?.valid || runtimeDiagnostics.code === 'SHORT_CIRCUIT';
            if (shouldShow) {
                const runtimeStatusMessage = buildRuntimeDiagnosticsStatusMessage(runtimeDiagnostics);
                this.app?.chartWorkspace?.setRuntimeStatus?.(runtimeStatusMessage);
                this.updateStatus(runtimeStatusMessage);

                const primaryHint = getPrimaryRuntimeHint(runtimeDiagnostics);
                if (primaryHint) {
                    this.app?.interaction?.showStatusAction?.({
                        label: '排查建议',
                        ariaLabel: '查看当前诊断建议',
                        statusText: runtimeStatusMessage,
                        durationMs: 6000,
                        onAction: () => {
                            this.app?.chartWorkspace?.setRuntimeStatus?.(runtimeStatusMessage);
                            this.updateStatus(runtimeStatusMessage);
                        }
                    });
                }
            }
        }

        if (results?.valid && this.app?.interaction?.selectedComponent) {
            const comp = this.app?.circuit?.getComponent?.(this.app.interaction.selectedComponent);
            if (comp) {
                this.app?.interaction?.updateSelectedComponentReadouts?.(comp);
            }
        }

        return runtimeDiagnostics;
    }

    showSimulationStarted(topologyWarning = '') {
        this.setSimulationControlsRunningImpl(true);
        this.app?.renderer?.updateWireAnimations?.(true);
        this.app?.chartWorkspace?.setRuntimeStatus?.(topologyWarning || '');
        this.updateStatus(topologyWarning ? `模拟运行中（${topologyWarning}）` : '模拟运行中');
    }

    showSimulationStopped() {
        this.setSimulationControlsRunningImpl(false);
        this.app?.renderer?.updateWireAnimations?.(false);
        this.app?.chartWorkspace?.setRuntimeStatus?.('');
        this.updateStatus('模拟已停止');
    }

    showCircuitCleared() {
        this.updateStatus('电路已清空');
    }

    showCircuitLoaded({ data, statusText = '', silent = false } = {}) {
        if (silent) return;
        const componentCount = Array.isArray(data?.components) ? data.components.length : 0;
        this.updateStatus(statusText || `已加载电路 (${componentCount} 个元器件)`);
    }

    showCircuitExported() {
        this.updateStatus('电路已导出');
    }

    showImportError(err) {
        const message = '导入失败: ' + (err?.message || String(err));
        this.updateStatus(message);
        if (typeof alert === 'function') {
            alert(message);
        }
    }
}
