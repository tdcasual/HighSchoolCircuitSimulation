import { installInteractionCoreInputEventDelegates } from './InteractionCoreInputEventDelegates.js';
import { installInteractionCoreInputViewportDelegates } from './InteractionCoreInputViewportDelegates.js';
import { installInteractionCoreInputToolPanelDelegates } from './InteractionCoreInputToolPanelDelegates.js';
import { installInteractionCoreInputResolverDelegates } from './InteractionCoreInputResolverDelegates.js';

export function installInteractionCoreInputDelegates(InteractionManagerClass) {
    installInteractionCoreInputEventDelegates(InteractionManagerClass);
    installInteractionCoreInputViewportDelegates(InteractionManagerClass);
    installInteractionCoreInputToolPanelDelegates(InteractionManagerClass);
    installInteractionCoreInputResolverDelegates(InteractionManagerClass);
}
