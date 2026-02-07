import { installInteractionTailHistoryDelegates } from './InteractionTailHistoryDelegates.js';
import { installInteractionTailAlignmentDelegates } from './InteractionTailAlignmentDelegates.js';

export function installInteractionTailHistoryAlignmentDelegates(InteractionManagerClass) {
    installInteractionTailHistoryDelegates(InteractionManagerClass);
    installInteractionTailAlignmentDelegates(InteractionManagerClass);
}
