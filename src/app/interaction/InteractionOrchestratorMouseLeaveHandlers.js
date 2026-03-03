import { setInteractionModeContext } from './InteractionModeBridge.js';
import { syncActiveWireStartAfterCompaction } from './InteractionOrchestratorHelpers.js';

function hasWireIdentifier(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

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
        this.isDraggingWireEndpoint = false;
        this.wireEndpointDrag = null;
        this.renderer.clearTerminalHighlight();
        const affectedIds = Array.isArray(drag?.affected)
            ? drag.affected.map((item) => item?.wireId).filter(hasWireIdentifier)
            : [];
        const scopeWireIds = Array.from(new Set([drag?.wireId, ...affectedIds].filter(hasWireIdentifier)));
        const compacted = this.compactWiresAndRefresh({
            preferredWireId: hasWireIdentifier(drag?.wireId) ? drag.wireId : this.selectedWire,
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
            preferredWireId: hasWireIdentifier(drag?.wireId) ? drag.wireId : this.selectedWire,
            scopeWireIds: hasWireIdentifier(drag?.wireId) ? [drag.wireId] : null
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
