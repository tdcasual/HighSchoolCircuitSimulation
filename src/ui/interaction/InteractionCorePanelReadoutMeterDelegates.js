import * as MeasurementReadoutController from './MeasurementReadoutController.js';

export function installInteractionCorePanelReadoutMeterDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        createMeterSelfReadingControl(comp) {
            return MeasurementReadoutController.createMeterSelfReadingControl.call(this, comp);
        }
    });
}
