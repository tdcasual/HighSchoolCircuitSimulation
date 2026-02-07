import * as AlignmentGuideController from './AlignmentGuideController.js';

export function installInteractionTailAlignmentDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        detectAlignment(draggedId, x, y) {
            return AlignmentGuideController.detectAlignment.call(this, draggedId, x, y);
        },

        showAlignmentGuides(alignment) {
            return AlignmentGuideController.showAlignmentGuides.call(this, alignment);
        },

        hideAlignmentGuides() {
            return AlignmentGuideController.hideAlignmentGuides.call(this);
        }
    });
}
