import * as PropertyPanelController from './PropertyPanelController.js';

export const interactionCorePanelPropertyMethods = {
        updatePropertyPanel(comp) {
            return PropertyPanelController.updatePropertyPanel.call(this, comp);
        }
    };
