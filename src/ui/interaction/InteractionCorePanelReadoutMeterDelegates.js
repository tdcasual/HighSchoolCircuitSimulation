import * as MeasurementReadoutController from './MeasurementReadoutController.js';

export const interactionCorePanelReadoutMeterMethods = {
        createMeterSelfReadingControl(comp) {
            return MeasurementReadoutController.createMeterSelfReadingControl.call(this, comp);
        }
    };
