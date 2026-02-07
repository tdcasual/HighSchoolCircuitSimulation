import { installInteractionCoreInputCoordinateDelegates } from './InteractionCoreInputCoordinateDelegates.js';
import { installInteractionCoreInputViewportControlDelegates } from './InteractionCoreInputViewportControlDelegates.js';

export function installInteractionCoreInputViewportDelegates(InteractionManagerClass) {
    installInteractionCoreInputCoordinateDelegates(InteractionManagerClass);
    installInteractionCoreInputViewportControlDelegates(InteractionManagerClass);
}
