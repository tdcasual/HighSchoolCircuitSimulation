import * as DragBehaviors from './DragBehaviors.js';

export function installInteractionCoreCircuitDragDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        startDragging(componentG, e) {
            return DragBehaviors.startDragging.call(this, componentG, e);
        },

        registerDragListeners(startEvent, onMove, onUp) {
            return DragBehaviors.registerDragListeners.call(this, startEvent, onMove, onUp);
        },

        startTerminalExtend(componentId, terminalIndex, e) {
            return DragBehaviors.startTerminalExtend.call(this, componentId, terminalIndex, e);
        },

        startRheostatDrag(componentId, e) {
            return DragBehaviors.startRheostatDrag.call(this, componentId, e);
        },

        startParallelPlateCapacitorDrag(componentId, e) {
            return DragBehaviors.startParallelPlateCapacitorDrag.call(this, componentId, e);
        }
    });
}
