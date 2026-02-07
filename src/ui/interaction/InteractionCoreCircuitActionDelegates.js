import * as ComponentActions from './ComponentActions.js';

export function installInteractionCoreCircuitActionDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        addComponent(type, x, y) {
            return ComponentActions.addComponent.call(this, type, x, y);
        },

        deleteComponent(id) {
            return ComponentActions.deleteComponent.call(this, id);
        },

        deleteWire(id) {
            return ComponentActions.deleteWire.call(this, id);
        },

        rotateComponent(id) {
            return ComponentActions.rotateComponent.call(this, id);
        },

        toggleSwitch(id) {
            return ComponentActions.toggleSwitch.call(this, id);
        }
    });
}
