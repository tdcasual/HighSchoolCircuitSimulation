import { applyComponentPropertyDialogChanges } from './ComponentPropertySchema.js';

function readFieldValue(id, fallback = '') {
    const element = document.getElementById(id);
    if (!element || !('value' in element)) {
        return String(fallback ?? '');
    }
    return String(element.value ?? '');
}

function safeHasClass(element, className) {
    if (!element || !element.classList || typeof element.classList.contains !== 'function') return false;
    try {
        return element.classList.contains(className);
    } catch (_) {
        return false;
    }
}

export function applyDialogChanges() {
    if (!this.editingComponent) return;

    const comp = this.editingComponent;

    try {
        this.runWithHistory('修改属性', () => {
            const appliedBySharedSchema = applyComponentPropertyDialogChanges({
                component: comp,
                readFieldValue,
                safeParseFloat: this.safeParseFloat
            });

            if (appliedBySharedSchema && comp.type === 'ParallelPlateCapacitor') {
                this.recomputeParallelPlateCapacitance?.(comp, { updateVisual: false });
            }

            if (!appliedBySharedSchema && comp.type === 'Switch') {
                const switchClose = document.getElementById('switch-close');
                comp.closed = safeHasClass(switchClose, 'active');
            }

            this.circuit.markSolverCircuitDirty();

            if (comp.type === 'BlackBox') {
                this.renderer.render();
                this.selectComponent(comp.id);
            } else {
                this.renderer.refreshComponent(comp);
                this.renderer.setSelected(comp.id, true);
                this.renderer.updateConnectedWires(comp.id);
                this.updatePropertyPanel(comp);
            }

            this.hideDialog();
            this.updateStatus('属性已更新');
        });
    } catch (error) {
        if (this.logger && typeof this.logger.error === 'function') {
            this.logger.error('Error applying dialog changes:', error);
        }
        this.updateStatus('更新失败：' + error.message);
    }
}
