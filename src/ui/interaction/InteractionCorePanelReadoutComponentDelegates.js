import * as MeasurementReadoutController from './MeasurementReadoutController.js';

export function installInteractionCorePanelReadoutComponentDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        updateSelectedComponentReadouts(comp) {
            return MeasurementReadoutController.updateSelectedComponentReadouts.call(this, comp);
        },

        updateRheostatPanelValues(comp) {
            return MeasurementReadoutController.updateRheostatPanelValues.call(this, comp);
        }
    });
}
