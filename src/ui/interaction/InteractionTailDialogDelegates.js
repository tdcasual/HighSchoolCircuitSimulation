import { installInteractionTailDialogLifecycleDelegates } from './InteractionTailDialogLifecycleDelegates.js';
import { installInteractionTailDialogUtilityDelegates } from './InteractionTailDialogUtilityDelegates.js';

export function installInteractionTailDialogDelegates(InteractionManagerClass) {
    installInteractionTailDialogLifecycleDelegates(InteractionManagerClass);
    installInteractionTailDialogUtilityDelegates(InteractionManagerClass);
}
