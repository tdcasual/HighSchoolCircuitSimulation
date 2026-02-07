import * as MeasurementReadoutController from './MeasurementReadoutController.js';

export function installInteractionCorePanelReadoutCapacitorDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        recomputeParallelPlateCapacitance(comp, options = {}) {
            return MeasurementReadoutController.recomputeParallelPlateCapacitance.call(this, comp, options);
        },

        updateParallelPlateCapacitorPanelValues(comp) {
            return MeasurementReadoutController.updateParallelPlateCapacitorPanelValues.call(this, comp);
        }
    });
}
