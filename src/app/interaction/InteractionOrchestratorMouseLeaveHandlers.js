import { setInteractionModeContext } from './InteractionModeBridge.js';
import { syncActiveWireStartAfterCompaction } from './InteractionOrchestratorHelpers.js';

export function handleMouseLeave(_e) {
    this.quickActionBar?.notifyActivity?.();
    this.wireModeGesture = null;
    if (this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = '';
    }
    if (this.isDraggingWireEndpoint) {
        const drag = this.wireEndpointDrag;
        setInteractionModeContext(this, {
            isDraggingWireEndpoint: false
        }, {
            source: 'onMouseLeave:endpoint-drag-end'
        });
        this.wireEndpointDrag = null;
        this.renderer.clearTerminalHighlight();
        const affectedIds = Array.isArray(drag?.affected)
            ? drag.affected.map((item) => item?.wireId).filter(Boolean)
            : [];
        const scopeWireIds = Array.from(new Set([drag?.wireId, ...affectedIds].filter(Boolean)));
        const compacted = this.compactWiresAndRefresh({
            preferredWireId: drag?.wireId || this.selectedWire,
            scopeWireIds
        });
        syncActiveWireStartAfterCompaction(this, compacted);
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }
    if (this.isDraggingWire) {
        const drag = this.wireDrag;
        this.isDraggingWire = false;
        this.wireDrag = null;
        this.compactWiresAndRefresh({
            preferredWireId: drag?.wireId || this.selectedWire,
            scopeWireIds: drag?.wireId ? [drag.wireId] : null
        });
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }
    if (this.isDragging) {
        this.isDragging = false;
        this.dragTarget = null;
        this.dragGroup = null;
        this.isDraggingComponent = false;
        this.hideAlignmentGuides();
        this.circuit.rebuildNodes();
        this.commitHistoryTransaction();
    }
    this.pointerDownInfo = null;
}
