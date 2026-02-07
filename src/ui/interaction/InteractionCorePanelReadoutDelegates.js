import { installInteractionCorePanelReadoutMeterDelegates } from './InteractionCorePanelReadoutMeterDelegates.js';
import { installInteractionCorePanelReadoutComponentDelegates } from './InteractionCorePanelReadoutComponentDelegates.js';
import { installInteractionCorePanelReadoutCapacitorDelegates } from './InteractionCorePanelReadoutCapacitorDelegates.js';

export function installInteractionCorePanelReadoutDelegates(InteractionManagerClass) {
    installInteractionCorePanelReadoutMeterDelegates(InteractionManagerClass);
    installInteractionCorePanelReadoutComponentDelegates(InteractionManagerClass);
    installInteractionCorePanelReadoutCapacitorDelegates(InteractionManagerClass);
}
