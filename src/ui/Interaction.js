/**
 * Interaction.js - 交互管理器
 * 处理拖放、连线、选择等用户交互
 */

import { initializeInteractionState } from './interaction/InteractionStateInitializer.js';
import { installInteractionCoreDelegates } from './interaction/InteractionCoreDelegates.js';
import { installInteractionTailDelegates } from './interaction/InteractionTailDelegates.js';

export class InteractionManager {
    constructor(app) {
        initializeInteractionState(this, app);
        this.hideContextMenuHandler = () => {
            this.hideContextMenu();
        };
        this.bindEvents();
    }
}

installInteractionCoreDelegates(InteractionManager);
installInteractionTailDelegates(InteractionManager);
