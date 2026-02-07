import * as MeasurementReadoutController from './MeasurementReadoutController.js';

export function installInteractionCorePanelReadoutDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
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
