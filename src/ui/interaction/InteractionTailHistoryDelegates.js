import { installInteractionTailHistorySnapshotDelegates } from './InteractionTailHistorySnapshotDelegates.js';
import { installInteractionTailHistoryTransactionDelegates } from './InteractionTailHistoryTransactionDelegates.js';
import { installInteractionTailHistoryNavigationDelegates } from './InteractionTailHistoryNavigationDelegates.js';

export function installInteractionTailHistoryDelegates(InteractionManagerClass) {
    installInteractionTailHistorySnapshotDelegates(InteractionManagerClass);
    installInteractionTailHistoryTransactionDelegates(InteractionManagerClass);
    installInteractionTailHistoryNavigationDelegates(InteractionManagerClass);
}
