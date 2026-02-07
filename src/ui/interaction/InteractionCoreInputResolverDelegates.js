import { installInteractionCoreInputTargetResolverDelegates } from './InteractionCoreInputTargetResolverDelegates.js';
import { installInteractionCoreInputPointerSnapDelegates } from './InteractionCoreInputPointerSnapDelegates.js';

export function installInteractionCoreInputResolverDelegates(InteractionManagerClass) {
    installInteractionCoreInputTargetResolverDelegates(InteractionManagerClass);
    installInteractionCoreInputPointerSnapDelegates(InteractionManagerClass);
}
