import { installInteractionCoreInputPointerLifecycleDelegates } from './InteractionCoreInputPointerLifecycleDelegates.js';
import { installInteractionCoreInputPointerGestureDelegates } from './InteractionCoreInputPointerGestureDelegates.js';

export function installInteractionCoreInputPointerDelegates(InteractionManagerClass) {
    installInteractionCoreInputPointerLifecycleDelegates(InteractionManagerClass);
    installInteractionCoreInputPointerGestureDelegates(InteractionManagerClass);
}
