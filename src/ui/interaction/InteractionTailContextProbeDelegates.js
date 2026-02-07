import * as ContextMenuController from './ContextMenuController.js';
import * as ProbeActions from './ProbeActions.js';
import * as ComponentActions from './ComponentActions.js';

export function installInteractionTailContextProbeDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        showContextMenu(e, componentId) {
            return ContextMenuController.showContextMenu.call(this, e, componentId);
        },

        showWireContextMenu(e, wireId) {
            return ContextMenuController.showWireContextMenu.call(this, e, wireId);
        },

        showProbeContextMenu(e, probeId, wireId) {
            return ContextMenuController.showProbeContextMenu.call(this, e, probeId, wireId);
        },

        renameObservationProbe(probeId, nextLabel = null) {
            return ProbeActions.renameObservationProbe.call(this, probeId, nextLabel);
        },

        deleteObservationProbe(probeId) {
            return ProbeActions.deleteObservationProbe.call(this, probeId);
        },

        addProbePlot(probeId) {
            return ProbeActions.addProbePlot.call(this, probeId);
        },

        addObservationProbeForWire(wireId, probeType) {
            return ProbeActions.addObservationProbeForWire.call(this, wireId, probeType);
        },

        hideContextMenu() {
            return ContextMenuController.hideContextMenu.call(this);
        },

        duplicateComponent(id) {
            return ComponentActions.duplicateComponent.call(this, id);
        }
    });
}
