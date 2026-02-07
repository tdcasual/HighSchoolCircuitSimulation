import { installInteractionTailContextMenuDelegates } from './InteractionTailContextMenuDelegates.js';
import { installInteractionTailProbeDelegates } from './InteractionTailProbeDelegates.js';

export function installInteractionTailContextProbeDelegates(InteractionManagerClass) {
    installInteractionTailContextMenuDelegates(InteractionManagerClass);
    installInteractionTailProbeDelegates(InteractionManagerClass);
}
