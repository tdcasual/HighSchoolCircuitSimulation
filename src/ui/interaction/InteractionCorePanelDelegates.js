import * as SelectionPanelController from './SelectionPanelController.js';
import * as PropertyPanelController from './PropertyPanelController.js';
import * as MeasurementReadoutController from './MeasurementReadoutController.js';
import * as SnapController from './SnapController.js';

export function installInteractionCorePanelDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        selectComponent(id) {
            return SelectionPanelController.selectComponent.call(this, id);
        },

        selectWire(id) {
            return SelectionPanelController.selectWire.call(this, id);
        },

        findNearbyTerminal(x, y, threshold) {
            return SnapController.findNearbyTerminal.call(this, x, y, threshold);
        },

        clearSelection() {
            return SelectionPanelController.clearSelection.call(this);
        },

        updatePropertyPanel(comp) {
            return PropertyPanelController.updatePropertyPanel.call(this, comp);
        },

        createMeterSelfReadingControl(comp) {
            return MeasurementReadoutController.createMeterSelfReadingControl.call(this, comp);
        },

        updateSelectedComponentReadouts(comp) {
            return MeasurementReadoutController.updateSelectedComponentReadouts.call(this, comp);
        },

        updateRheostatPanelValues(comp) {
            return MeasurementReadoutController.updateRheostatPanelValues.call(this, comp);
        },

        recomputeParallelPlateCapacitance(comp, options = {}) {
            return MeasurementReadoutController.recomputeParallelPlateCapacitance.call(this, comp, options);
        },

        updateParallelPlateCapacitorPanelValues(comp) {
            return MeasurementReadoutController.updateParallelPlateCapacitorPanelValues.call(this, comp);
        }
    });
}
