const LONG_PRESS_DELAY_MS = 420;
const MOVE_TOLERANCE_PX = 12;
const DRAG_MOVE_TOLERANCE_PX = 3;

function distanceSquared(aX, aY, bX, bY) {
    const dx = (aX || 0) - (bX || 0);
    const dy = (aY || 0) - (bY || 0);
    return dx * dx + dy * dy;
}

function resolveTargetDetails(eventTarget, interaction) {
    if (!eventTarget || typeof eventTarget.closest !== 'function') return null;

    const probeMarker = interaction.resolveProbeMarkerTarget?.(eventTarget);
    if (probeMarker) {
        const probeId = probeMarker.dataset?.probeId;
        const wireId = probeMarker.dataset?.wireId;
        if (probeId) {
            return { type: 'probe', probeId, wireId: wireId || null };
        }
    }

    const componentGroup = eventTarget.closest('.component');
    if (componentGroup?.dataset?.id) {
        return { type: 'component', componentId: componentGroup.dataset.id };
    }

    const wireGroup = eventTarget.closest('.wire-group');
    if (wireGroup?.dataset?.id) {
        return { type: 'wire', wireId: wireGroup.dataset.id };
    }

    return null;
}

export class TouchActionController {
    constructor(interaction, options = {}) {
        this.interaction = interaction;
        this.longPressDelayMs = Number.isFinite(options.longPressDelayMs)
            ? Math.max(120, Math.floor(options.longPressDelayMs))
            : LONG_PRESS_DELAY_MS;
        this.moveToleranceSq = Math.pow(
            Number.isFinite(options.moveTolerancePx)
                ? Math.max(2, options.moveTolerancePx)
                : MOVE_TOLERANCE_PX,
            2
        );
        this.dragMoveToleranceSq = Math.pow(
            Number.isFinite(options.dragMoveTolerancePx)
                ? Math.max(1, options.dragMoveTolerancePx)
                : DRAG_MOVE_TOLERANCE_PX,
            2
        );
        this.session = null;
    }

    resolveActiveMoveToleranceSq(target = null) {
        const interaction = this.interaction;
        if (!interaction) return this.moveToleranceSq;
        if (target?.type === 'probe') return this.moveToleranceSq;

        const dragActive = !!(
            interaction.isDragging
            || interaction.isDraggingWire
            || interaction.isDraggingWireEndpoint
        );
        if (!dragActive) return this.moveToleranceSq;

        return Math.min(this.moveToleranceSq, this.dragMoveToleranceSq);
    }

    shouldTrackPointer(event) {
        const pointerType = event?.pointerType || '';
        if (pointerType !== 'touch' && pointerType !== 'pen') return false;
        if (this.interaction?.blockSinglePointerInteraction) return false;
        if (this.interaction?.pendingToolType) return false;
        if (this.interaction?.isWiring) return false;
        return true;
    }

    onPointerDown(event) {
        if (!this.shouldTrackPointer(event)) {
            this.cancel();
            return;
        }

        const target = resolveTargetDetails(event.target, this.interaction);
        if (!target) {
            this.cancel();
            return;
        }

        this.cancel();
        const pointerId = event.pointerId;
        const startX = Number(event.clientX) || 0;
        const startY = Number(event.clientY) || 0;
        const session = {
            pointerId,
            startX,
            startY,
            lastX: startX,
            lastY: startY,
            target,
            targetNode: event.target,
            triggered: false,
            timer: null
        };
        session.timer = setTimeout(() => this.triggerLongPress(), this.longPressDelayMs);
        this.session = session;
    }

    onPointerMove(event) {
        if (!this.session) return;
        if (event.pointerId !== this.session.pointerId) return;
        if (this.session.triggered) return;

        const nextX = Number(event.clientX) || 0;
        const nextY = Number(event.clientY) || 0;
        this.session.lastX = nextX;
        this.session.lastY = nextY;

        const movedSq = distanceSquared(nextX, nextY, this.session.startX, this.session.startY);
        if (movedSq > this.resolveActiveMoveToleranceSq(this.session.target)) {
            this.cancel();
        }
    }

    onPointerUp(event) {
        if (!this.session) return false;
        if (event.pointerId !== this.session.pointerId) return false;
        const consumed = !!this.session.triggered;
        this.cancel();
        return consumed;
    }

    onPointerCancel(event) {
        if (!this.session) return;
        if (!event || event.pointerId === this.session.pointerId) {
            this.cancel();
        }
    }

    cancel() {
        if (!this.session) return;
        if (this.session.timer) {
            clearTimeout(this.session.timer);
        }
        this.session = null;
    }

    triggerLongPress() {
        if (!this.session || this.session.triggered) return;
        const { target, targetNode, lastX, lastY } = this.session;
        this.session.triggered = true;

        // End any in-progress drag/wire state before opening action menus.
        if (typeof this.interaction.endPrimaryInteractionForGesture === 'function') {
            this.interaction.endPrimaryInteractionForGesture();
        }

        const syntheticEvent = {
            clientX: lastX,
            clientY: lastY,
            target: targetNode,
            preventDefault() {},
            stopPropagation() {}
        };

        if (target.type === 'component') {
            this.interaction.selectComponent?.(target.componentId);
            this.interaction.showContextMenu?.(syntheticEvent, target.componentId);
            return;
        }

        if (target.type === 'wire') {
            this.interaction.selectWire?.(target.wireId);
            this.interaction.showWireContextMenu?.(syntheticEvent, target.wireId);
            return;
        }

        if (target.type === 'probe') {
            if (target.wireId) this.interaction.selectWire?.(target.wireId);
            this.interaction.showProbeContextMenu?.(syntheticEvent, target.probeId, target.wireId || null);
        }
    }
}
