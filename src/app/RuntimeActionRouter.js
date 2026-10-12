import { resetEntityIdCounter, updateEntityIdCounterFromExisting } from '../utils/id/EntityIdCounter.js';
import { buildRuntimeDiagnostics } from '../core/simulation/RuntimeDiagnostics.js';
import { RuntimeStorageEntries } from '../utils/storage/StorageRegistry.js';
import { safeRemoveStorageItem } from '../utils/storage/SafeStorage.js';
import { parseAppDocument, restoreAppUi } from './AppDocument.js';
import { isActiveSourceType } from '../core/simulation/SourceTypes.js';

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
            if (isActiveSourceType(comp?.type)) {
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

        if (this.app?.simulationDriver && typeof this.app.simulationDriver.start === 'function') {
            this.app.simulationDriver.start();
        } else {
            this.app?.circuit?.startSimulation?.();
        }
        this.uiBridge?.showSimulationStarted?.(topologyWarning);
        return true;
    }

    stopSimulation() {
        if (this.app?.simulationDriver && typeof this.app.simulationDriver.stop === 'function') {
            this.app.simulationDriver.stop();
        } else {
            this.app?.circuit?.stopSimulation?.();
        }
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
        const parsed = parseAppDocument(data);
        this.app?.circuit?.fromJSON?.(parsed.circuit);
        if (parsed.recoveredLegacyUi) {
            this.app?.logger?.warn?.('recoveredLegacyUi: peeled exerciseBoard/chartWorkspace from circuit meta');
        }
        this.stopSimulationImpl();
        this.app?.beginCircuitStorageOwnership?.(options.storageSource || 'runtime-load');
        restoreAppUi({
            exerciseBoard: this.app?.exerciseBoard,
            chartWorkspace: this.app?.chartWorkspace,
            ui: parsed.ui,
            solverBackend: this.app?.circuit?.solverBackend,
            applyMode: !this.app?.runtimeOptions?.enabled && !this.app?.runtimeOptions?.solverBackendExplicit
        });

        const components = parsed.circuit.components;
        const wires = parsed.circuit.wires;
        const allIds = [
            ...components.map((component) => component.id),
            ...wires.map((wire) => wire.id)
        ];
        this.updateIdCounterFromExistingImpl(allIds);

        this.app?.renderer?.render?.();
        this.app?.interaction?.clearSelection?.();
        this.app?.chartWorkspace?.refreshComponentOptions?.();
        this.app?.chartWorkspace?.refreshDialGauges?.();
        const resolvedStatus = statusText || `已导入电路: ${parsed.circuit.meta?.name || '未命名'}`;
        this.uiBridge?.showCircuitLoaded?.({ data: parsed.circuit, statusText: resolvedStatus, silent });

        return {
            componentCount: components.length,
            wireCount: wires.length
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
                const parsed = parseAppDocument(data);
                this.loadCircuitData(data, {
                    statusText: `已导入电路: ${parsed.circuit.meta?.name || '未命名'}`,
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
