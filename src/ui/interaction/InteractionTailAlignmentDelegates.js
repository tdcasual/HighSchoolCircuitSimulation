import * as AlignmentGuideController from './AlignmentGuideController.js';

export const interactionTailAlignmentMethods = {
        detectAlignment(draggedId, x, y) {
            return AlignmentGuideController.detectAlignment.call(this, draggedId, x, y);
        },

        showAlignmentGuides(alignment) {
            return AlignmentGuideController.showAlignmentGuides.call(this, alignment);
        },

        hideAlignmentGuides() {
            return AlignmentGuideController.hideAlignmentGuides.call(this);
        }
    };
