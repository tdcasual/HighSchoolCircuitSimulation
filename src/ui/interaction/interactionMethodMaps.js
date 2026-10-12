/** Composed InteractionManager method maps. One install site in Interaction.js. */
import { assignInteractionMethods } from './assignInteractionMethods.js';
import { interactionCoreCircuitActionMethods } from './InteractionCoreCircuitActionDelegates.js';
import { interactionCoreCircuitDragMethods } from './InteractionCoreCircuitDragDelegates.js';
import { interactionCoreCircuitSnapMethods } from './InteractionCoreCircuitSnapDelegates.js';
import { interactionCoreCircuitWireCompactionMethods } from './InteractionCoreCircuitWireCompactionDelegates.js';
import { interactionCoreCircuitWireDragMethods } from './InteractionCoreCircuitWireDragDelegates.js';
import { interactionCoreCircuitWireSearchMethods } from './InteractionCoreCircuitWireSearchDelegates.js';
import { interactionCoreCircuitWireSplitMethods } from './InteractionCoreCircuitWireSplitDelegates.js';
import { interactionCoreCircuitWiringFlowMethods } from './InteractionCoreCircuitWiringFlowDelegates.js';
import { interactionCoreInputBindingsMethods } from './InteractionCoreInputBindingsDelegates.js';
import { interactionCoreInputCoordinateMethods } from './InteractionCoreInputCoordinateDelegates.js';
import { interactionCoreInputMouseContextMethods } from './InteractionCoreInputMouseContextDelegates.js';
import { interactionCoreInputMouseFlowMethods } from './InteractionCoreInputMouseFlowDelegates.js';
import { interactionCoreInputPanelStateMethods } from './InteractionCoreInputPanelStateDelegates.js';
import { interactionCoreInputPlacementMethods } from './InteractionCoreInputPlacementDelegates.js';
import { interactionCoreInputPointerGestureMethods } from './InteractionCoreInputPointerGestureDelegates.js';
import { interactionCoreInputPointerLifecycleMethods } from './InteractionCoreInputPointerLifecycleDelegates.js';
import { interactionCoreInputPointerSnapMethods } from './InteractionCoreInputPointerSnapDelegates.js';
import { interactionCoreInputTargetResolverMethods } from './InteractionCoreInputTargetResolverDelegates.js';
import { interactionCoreInputToolboxMethods } from './InteractionCoreInputToolboxDelegates.js';
import { interactionCoreInputViewportControlMethods } from './InteractionCoreInputViewportControlDelegates.js';
import { interactionCorePanelPropertyMethods } from './InteractionCorePanelPropertyDelegates.js';
import { interactionCorePanelReadoutCapacitorMethods } from './InteractionCorePanelReadoutCapacitorDelegates.js';
import { interactionCorePanelReadoutComponentMethods } from './InteractionCorePanelReadoutComponentDelegates.js';
import { interactionCorePanelReadoutMeterMethods } from './InteractionCorePanelReadoutMeterDelegates.js';
import { interactionCorePanelSelectionMethods } from './InteractionCorePanelSelectionDelegates.js';
import { interactionTailAlignmentMethods } from './InteractionTailAlignmentDelegates.js';
import { interactionTailContextMenuMethods } from './InteractionTailContextMenuDelegates.js';
import { interactionTailDialogLifecycleMethods } from './InteractionTailDialogLifecycleDelegates.js';
import { interactionTailDialogUtilityMethods } from './InteractionTailDialogUtilityDelegates.js';
import { interactionTailHistoryNavigationMethods } from './InteractionTailHistoryNavigationDelegates.js';
import { interactionTailHistorySnapshotMethods } from './InteractionTailHistorySnapshotDelegates.js';
import { interactionTailHistoryTransactionMethods } from './InteractionTailHistoryTransactionDelegates.js';
import { interactionTailProbeMethods } from './InteractionTailProbeDelegates.js';

export const interactionMethodMaps = {
    ...interactionCoreCircuitActionMethods,
    ...interactionCoreCircuitDragMethods,
    ...interactionCoreCircuitSnapMethods,
    ...interactionCoreCircuitWireCompactionMethods,
    ...interactionCoreCircuitWireDragMethods,
    ...interactionCoreCircuitWireSearchMethods,
    ...interactionCoreCircuitWireSplitMethods,
    ...interactionCoreCircuitWiringFlowMethods,
    ...interactionCoreInputBindingsMethods,
    ...interactionCoreInputCoordinateMethods,
    ...interactionCoreInputMouseContextMethods,
    ...interactionCoreInputMouseFlowMethods,
    ...interactionCoreInputPanelStateMethods,
    ...interactionCoreInputPlacementMethods,
    ...interactionCoreInputPointerGestureMethods,
    ...interactionCoreInputPointerLifecycleMethods,
    ...interactionCoreInputPointerSnapMethods,
    ...interactionCoreInputTargetResolverMethods,
    ...interactionCoreInputToolboxMethods,
    ...interactionCoreInputViewportControlMethods,
    ...interactionCorePanelPropertyMethods,
    ...interactionCorePanelReadoutCapacitorMethods,
    ...interactionCorePanelReadoutComponentMethods,
    ...interactionCorePanelReadoutMeterMethods,
    ...interactionCorePanelSelectionMethods,
    ...interactionTailAlignmentMethods,
    ...interactionTailContextMenuMethods,
    ...interactionTailDialogLifecycleMethods,
    ...interactionTailDialogUtilityMethods,
    ...interactionTailHistoryNavigationMethods,
    ...interactionTailHistorySnapshotMethods,
    ...interactionTailHistoryTransactionMethods,
    ...interactionTailProbeMethods,
};

export function installInteractionMethodMaps(host) {
    host.controllers = {
        circuit: {
            ...interactionCoreCircuitActionMethods,
            ...interactionCoreCircuitDragMethods,
            ...interactionCoreCircuitSnapMethods,
            ...interactionCoreCircuitWireCompactionMethods,
            ...interactionCoreCircuitWireDragMethods,
            ...interactionCoreCircuitWireSearchMethods,
            ...interactionCoreCircuitWireSplitMethods,
            ...interactionCoreCircuitWiringFlowMethods
        },
        input: {
            ...interactionCoreInputBindingsMethods,
            ...interactionCoreInputCoordinateMethods,
            ...interactionCoreInputMouseContextMethods,
            ...interactionCoreInputMouseFlowMethods,
            ...interactionCoreInputPanelStateMethods,
            ...interactionCoreInputPlacementMethods,
            ...interactionCoreInputPointerGestureMethods,
            ...interactionCoreInputPointerLifecycleMethods,
            ...interactionCoreInputPointerSnapMethods,
            ...interactionCoreInputTargetResolverMethods,
            ...interactionCoreInputToolboxMethods,
            ...interactionCoreInputViewportControlMethods
        },
        panel: {
            ...interactionCorePanelPropertyMethods,
            ...interactionCorePanelReadoutCapacitorMethods,
            ...interactionCorePanelReadoutComponentMethods,
            ...interactionCorePanelReadoutMeterMethods,
            ...interactionCorePanelSelectionMethods
        },
        tail: {
            ...interactionTailAlignmentMethods,
            ...interactionTailContextMenuMethods,
            ...interactionTailDialogLifecycleMethods,
            ...interactionTailDialogUtilityMethods,
            ...interactionTailHistoryNavigationMethods,
            ...interactionTailHistorySnapshotMethods,
            ...interactionTailHistoryTransactionMethods,
            ...interactionTailProbeMethods
        }
    };
    assignInteractionMethods(host, interactionMethodMaps);
}

