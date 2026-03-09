import { resetEntityIdCounter, updateEntityIdCounterFromExisting } from '../utils/id/EntityIdCounter.js';
import { buildRuntimeDiagnostics } from '../core/simulation/RuntimeDiagnostics.js';
import { RuntimeStorageEntries } from '../utils/storage/StorageRegistry.js';
import { safeRemoveStorageItem } from '../utils/storage/SafeStorage.js';
import { safeInvokeMethod } from './AppSerialization.js';

export class RuntimeActionRouter {
    constructor(app, options = {}) {
        this.app = app;
        this.uiBridge = options.uiBridge || null;
        this.safeRemoveStorageItemImpl = options.safeRemoveStorageItemImpl || safeRemoveStorageItem;
        this.updateIdCounterFromExistingImpl = options.updateIdCounterFromExistingImpl || updateEntityIdCounterFromExisting;
        this.resetIdCounterImpl = options.resetIdCounterImpl || resetEntityIdCounter;
        this.stopSimulationImpl = options.stopSimulationImpl || (() => this.stopSimulation());
    }

    startSimulation() {
        if ((this.app?.circuit?.components?.size || 0) === 0) {
            this.uiBridge?.updateStatus?.('请先添加元器件');
            return false;
        }

        let hasPower = false;
        for (const comp of this.app?.circuit?.components?.values?.() || []) {
            if (comp?.type === 'PowerSource') {
                hasPower = true;
                break;
            }
        }
        if (!hasPower) {
            this.uiBridge?.updateStatus?.('电路中需要至少一个电源');
            return false;
        }

        const topologyReport = this.app?.circuit?.validateSimulationTopology?.(0) || { ok: true, warnings: [] };
        const topologyDiagnostics = buildRuntimeDiagnostics({ topologyReport });
        if (!topologyReport.ok) {
            const message = topologyDiagnostics.summary
                || topologyReport.error?.message
                || '电路拓扑校验失败，无法开始模拟';
            this.app?.chartWorkspace?.setRuntimeStatus?.(message);
            this.uiBridge?.updateStatus?.(message);
            return false;
        }

        const topologyWarning = topologyDiagnostics.code === 'FLOATING_SUBCIRCUIT'
            ? topologyDiagnostics.summary
            : '';

        this.app?.circuit?.startSimulation?.();
        this.uiBridge?.showSimulationStarted?.(topologyWarning);
        return true;
    }

    stopSimulation() {
        this.app?.circuit?.stopSimulation?.();
        this.uiBridge?.showSimulationStopped?.();
        return true;
    }

    clearCircuit() {
        this.stopSimulationImpl();
        this.app?.circuit?.clear?.();
        this.app?.renderer?.clear?.();
        this.resetIdCounterImpl();
        this.app?.interaction?.clearSelection?.();
        this.app?.chartWorkspace?.clearAllPlots?.();
        this.app?.chartWorkspace?.refreshDialGauges?.();
        this.app?.exerciseBoard?.reset?.();
        this.safeRemoveStorageItemImpl(RuntimeStorageEntries.circuitAutosave);
        this.uiBridge?.showCircuitCleared?.();
        return true;
    }

    loadCircuitData(data, options = {}) {
        const {
            statusText = '',
            silent = false
        } = options;
        if (!data || !Array.isArray(data.components) || !Array.isArray(data.wires)) {
            throw new Error('无效的电路 JSON：缺少 components/wires');
        }

        this.app?.beginCircuitStorageOwnership?.(options.storageSource || 'runtime-load');
        this.stopSimulationImpl();
        this.app?.circuit?.fromJSON?.(data);
        safeInvokeMethod(this.app?.exerciseBoard, 'fromJSON', data.meta?.exerciseBoard);

        const allIds = [
            ...data.components.map((component) => component.id),
            ...data.wires.map((wire) => wire.id)
        ];
        this.updateIdCounterFromExistingImpl(allIds);

        this.app?.renderer?.render?.();
        this.app?.interaction?.clearSelection?.();
        this.app?.chartWorkspace?.refreshComponentOptions?.();
        this.app?.chartWorkspace?.refreshDialGauges?.();
        safeInvokeMethod(this.app?.chartWorkspace, 'fromJSON', data.meta?.chartWorkspace);
        this.uiBridge?.showCircuitLoaded?.({ data, statusText, silent });

        return {
            componentCount: data.components.length,
            wireCount: data.wires.length
        };
    }

    exportCircuit() {
        const data = typeof this.app?.buildSaveData === 'function'
            ? this.app.buildSaveData()
            : null;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `circuit_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        this.uiBridge?.showCircuitExported?.();
    }

    importCircuit(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                this.loadCircuitData(data, {
                    statusText: `已导入电路: ${data.meta?.name || '未命名'}`,
                    storageSource: 'manual-import'
                });
            } catch (err) {
                this.app?.logger?.error?.('Import error:', err);
                this.uiBridge?.showImportError?.(err);
            }
        };
        reader.readAsText(file);
    }
}
