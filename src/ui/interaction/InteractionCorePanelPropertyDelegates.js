import * as PropertyPanelController from './PropertyPanelController.js';

export function installInteractionCorePanelPropertyDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        updatePropertyPanel(comp) {
            return PropertyPanelController.updatePropertyPanel.call(this, comp);
        }
    });
}
