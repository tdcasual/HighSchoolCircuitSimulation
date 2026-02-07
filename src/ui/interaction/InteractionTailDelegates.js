import * as UIStateController from './UIStateController.js';
import * as PropertyDialogActions from './PropertyDialogActions.js';
import * as PropertyDialogController from './PropertyDialogController.js';
import * as ContextMenuController from './ContextMenuController.js';
import * as ProbeActions from './ProbeActions.js';
import * as ComponentActions from './ComponentActions.js';
import * as HistoryFacadeController from './HistoryFacadeController.js';
import * as AlignmentGuideController from './AlignmentGuideController.js';

export function installInteractionTailDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        showPropertyDialog(id) {
            return PropertyDialogController.showPropertyDialog.call(this, id);
        },

        hideDialog() {
            return UIStateController.hideDialog.call(this);
        },

        safeParseFloat(value, defaultValue, minValue = null, maxValue = null) {
            return UIStateController.safeParseFloat.call(this, value, defaultValue, minValue, maxValue);
        },

        getBlackBoxContainedComponentIds(boxComp, options = {}) {
            return UIStateController.getBlackBoxContainedComponentIds.call(this, boxComp, options);
        },

        applyDialogChanges() {
            return PropertyDialogActions.applyDialogChanges.call(this);
        },

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
        },

        captureHistoryState() {
            return HistoryFacadeController.captureHistoryState.call(this);
        },

        historyKey(state) {
            return HistoryFacadeController.historyKey.call(this, state);
        },

        getSelectionSnapshot() {
            return HistoryFacadeController.getSelectionSnapshot.call(this);
        },

        restoreSelectionSnapshot(snapshot) {
            HistoryFacadeController.restoreSelectionSnapshot.call(this, snapshot);
        },

        pushHistoryEntry(entry) {
            HistoryFacadeController.pushHistoryEntry.call(this, entry);
        },

        runWithHistory(label, action) {
            HistoryFacadeController.runWithHistory.call(this, label, action);
        },

        beginHistoryTransaction(label) {
            HistoryFacadeController.beginHistoryTransaction.call(this, label);
        },

        commitHistoryTransaction() {
            HistoryFacadeController.commitHistoryTransaction.call(this);
        },

        applyHistoryState(state, selection) {
            HistoryFacadeController.applyHistoryState.call(this, state, selection);
        },

        undo() {
            HistoryFacadeController.undo.call(this);
        },

        redo() {
            HistoryFacadeController.redo.call(this);
        },

        updateStatus(text) {
            return UIStateController.updateStatus.call(this, text);
        },

        detectAlignment(draggedId, x, y) {
            return AlignmentGuideController.detectAlignment.call(this, draggedId, x, y);
        },

        showAlignmentGuides(alignment) {
            return AlignmentGuideController.showAlignmentGuides.call(this, alignment);
        },

        hideAlignmentGuides() {
            return AlignmentGuideController.hideAlignmentGuides.call(this);
        }
    });
}
