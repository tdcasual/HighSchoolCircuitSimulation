import * as MeasurementReadoutController from './MeasurementReadoutController.js';

export const interactionCorePanelReadoutComponentMethods = {
        updateSelectedComponentReadouts(comp) {
            return MeasurementReadoutController.updateSelectedComponentReadouts.call(this, comp);
        },

        updateRheostatPanelValues(comp) {
            return MeasurementReadoutController.updateRheostatPanelValues.call(this, comp);
        }
    };
