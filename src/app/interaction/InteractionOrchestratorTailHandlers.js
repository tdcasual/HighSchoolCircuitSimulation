import { InteractionModes } from './InteractionModeStore.js';
import { readInteractionModeContext, setInteractionModeContext } from './InteractionModeBridge.js';
import { syncInteractionModeStore } from './InteractionModeStateMachine.js';
import { consumeActionResult, hasClass, safeClosest } from './InteractionOrchestratorHelpers.js';

export function onContextMenu(e) {
    e.preventDefault();
    this.touchActionController?.cancel?.();
    this.wireModeGesture = null;
    this.pointerDownInfo = null;
    const modeContext = readInteractionModeContext(this);
    if (modeContext.wiringActive && typeof this.cancelWiring === 'function') {
        this.cancelWiring();
    }
    if (typeof this.endPrimaryInteractionForGesture === 'function') {
        this.endPrimaryInteractionForGesture();
    }
    this.cancelPointerSession?.({
        source: 'onContextMenu',
        preserveSuspendedWiringSession: false
    });
    this.suspendedWiringSession = null;
    syncInteractionModeStore(this, { source: 'onContextMenu' });

    const probeMarker = this.resolveProbeMarkerTarget(e.target);
    if (probeMarker) {
        const probeId = probeMarker.dataset.probeId;
        const wireId = probeMarker.dataset.wireId;
        if (wireId) this.selectWire(wireId);
        this.showProbeContextMenu(e, probeId, wireId);
        return;
    }

    const componentG = safeClosest(e.target, '.component');
    if (componentG) {
        const id = componentG.dataset.id;
        this.selectComponent(id);
        this.showContextMenu(e, id);
    } else {
        const wireGroup = safeClosest(e.target, '.wire-group');
        if (wireGroup) {
            const id = wireGroup.dataset.id;
            this.selectWire(id);
            this.showWireContextMenu(e, id);
        } else {
            this.hideContextMenu();
        }
    }
}

export function onDoubleClick(e) {
    const probeMarker = this.resolveProbeMarkerTarget(e.target);
    if (probeMarker) {
        const probeId = probeMarker.dataset.probeId;
        if (probeId) {
            this.renameObservationProbe(probeId);
        }
        return;
    }

    // 双击在布线流程中优先保留布线语义，避免误触打开属性对话框。
    const modeState = syncInteractionModeStore(this, { source: 'onDoubleClick' });
    const modeContext = modeState?.context || null;
    if (
        modeState?.mode === InteractionModes.WIRE
        || modeContext?.pendingTool === 'Wire'
        || modeContext?.wiringActive
    ) {
        return;
    }

    // 双击元器件打开属性编辑
    const componentG = safeClosest(e.target, '.component');
    if (componentG) {
        this.showPropertyDialog(componentG.dataset.id);
    }
}

export function onKeyDown(e) {
    // 检查对话框是否打开
    const dialogOverlay = typeof document !== 'undefined'
        ? document.getElementById('dialog-overlay')
        : null;
    const isDialogOpen = !!dialogOverlay && !hasClass(dialogOverlay, 'hidden');

    // 如果对话框打开，只处理 Escape 键关闭对话框
    if (isDialogOpen) {
        if (e.key === 'Escape') {
            this.hideDialog();
        }
        return;
    }

    // 如果焦点在输入框、文本框等可编辑元素中，不处理快捷键
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
    const isEditing = activeElement && (
        activeElement.tagName === 'INPUT'
        || activeElement.tagName === 'TEXTAREA'
        || activeElement.tagName === 'SELECT'
        || activeElement.isContentEditable
    );

    if (isEditing) {
        return;
    }

    // Undo / Redo
    const modKey = e.metaKey || e.ctrlKey;
    if (modKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
            this.redo();
        } else {
            this.undo();
        }
        return;
    }
    if (modKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        this.redo();
        return;
    }

    // Delete键删除选中的元器件
    if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (this.selectedComponent) {
            consumeActionResult(this, this.deleteComponent(this.selectedComponent));
        } else if (this.selectedWire) {
            consumeActionResult(this, this.deleteWire(this.selectedWire));
        }
    }

    // R键旋转
    if (e.key === 'r' || e.key === 'R') {
        if (this.selectedComponent) {
            consumeActionResult(this, this.rotateComponent(this.selectedComponent));
        }
    }

    // Escape取消连线
    if (e.key === 'Escape') {
        this.cancelWiring();
        this.clearPendingToolType({ silent: true });
        setInteractionModeContext(this, {
            pendingTool: null,
            mobileMode: 'select',
            wireModeSticky: false,
            wiringActive: false
        }, {
            mode: InteractionModes.SELECT,
            source: 'onKeyDown:escape'
        });
        this.clearSelection();
    }
}
