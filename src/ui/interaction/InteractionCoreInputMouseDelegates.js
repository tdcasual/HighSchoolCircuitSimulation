import { installInteractionCoreInputMouseFlowDelegates } from './InteractionCoreInputMouseFlowDelegates.js';
import { installInteractionCoreInputMouseContextDelegates } from './InteractionCoreInputMouseContextDelegates.js';

export function installInteractionCoreInputMouseDelegates(InteractionManagerClass) {
    installInteractionCoreInputMouseFlowDelegates(InteractionManagerClass);
    installInteractionCoreInputMouseContextDelegates(InteractionManagerClass);
}
