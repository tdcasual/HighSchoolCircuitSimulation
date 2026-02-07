import { installInteractionTailDialogDelegates } from './InteractionTailDialogDelegates.js';
import { installInteractionTailContextProbeDelegates } from './InteractionTailContextProbeDelegates.js';
import { installInteractionTailHistoryAlignmentDelegates } from './InteractionTailHistoryAlignmentDelegates.js';

export function installInteractionTailDelegates(InteractionManagerClass) {
    installInteractionTailDialogDelegates(InteractionManagerClass);
    installInteractionTailContextProbeDelegates(InteractionManagerClass);
    installInteractionTailHistoryAlignmentDelegates(InteractionManagerClass);
}
