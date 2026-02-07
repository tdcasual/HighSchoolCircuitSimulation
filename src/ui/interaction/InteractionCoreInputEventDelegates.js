import { installInteractionCoreInputBindingsDelegates } from './InteractionCoreInputBindingsDelegates.js';
import { installInteractionCoreInputPointerDelegates } from './InteractionCoreInputPointerDelegates.js';
import { installInteractionCoreInputMouseDelegates } from './InteractionCoreInputMouseDelegates.js';

export function installInteractionCoreInputEventDelegates(InteractionManagerClass) {
    installInteractionCoreInputBindingsDelegates(InteractionManagerClass);
    installInteractionCoreInputPointerDelegates(InteractionManagerClass);
    installInteractionCoreInputMouseDelegates(InteractionManagerClass);
}
