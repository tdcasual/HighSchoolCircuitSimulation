import { presentLocalFeedback } from './UIStateController.js';
import { ComponentNames } from '../../components/Component.js';
import { getComponentPropertyDialogFields } from './ComponentPropertySchema.js';
import {
    createElement,
    createFormGroup,
    createSelectFormGroup,
    createSliderFormGroup,
    createCheckboxFormGroup,
    createSwitchToggleGroup,
    clearElement
} from '../../utils/SafeDOM.js';

function safeInvokeMethod(target, methodName, ...args) {
    const fn = target?.[methodName];
    if (typeof fn !== 'function') return undefined;
    try {
        return fn.apply(target, args);
    } catch (_) {
        return undefined;
    }
}

function safeAddClass(node, className) {
    safeInvokeMethod(node?.classList, 'add', className);
}

function safeRemoveClass(node, className) {
    safeInvokeMethod(node?.classList, 'remove', className);
}

function renderDialogFields(content, fields) {
    if (!Array.isArray(fields) || fields.length === 0) return false;
    for (const field of fields) {
        if (field.kind === 'select') {
            content.appendChild(createSelectFormGroup(field.label, {
                id: field.id,
                value: field.value,
                options: field.options || []
            }, field.hint || null));
            continue;
        }
        if (field.kind === 'slider') {
            content.appendChild(createSliderFormGroup(field.label, {
                id: field.id,
                valueId: field.valueId,
                value: field.value,
                displayValue: field.displayValue,
                min: field.min,
                max: field.max,
                step: field.step
            }));
            continue;
        }
        if (field.kind === 'checkbox') {
            content.appendChild(createCheckboxFormGroup(field.label, {
                id: field.id,
                checked: !!field.value
            }, field.hint || null));
            continue;
        }
        content.appendChild(createFormGroup(field.label, {
            id: field.id,
            value: field.value,
            min: field.min,
            max: field.max,
            step: field.step,
            unit: field.unit,
            placeholder: field.placeholder || ''
        }, field.hint || null));
    }
    return true;
}

export function showPropertyDialog(id) {
    const comp = this.circuit.getComponent(id);
    if (!comp) return;

    const dialog = document.getElementById('dialog-overlay');
    const title = document.getElementById('dialog-title');
    const content = document.getElementById('dialog-content');
    if (!dialog || !title || !content) {
        this.editingComponent = null;
        presentLocalFeedback.call(this, '属性对话框不可用', {
            scope: 'property-panel'
        });
        return;
    }

    this.editingComponent = comp;

    title.textContent = `编辑 ${ComponentNames[comp.type]}`;

    clearElement(content);
    const sharedDialogFields = getComponentPropertyDialogFields(comp);
    const renderSharedDialogFields = () => renderDialogFields(content, sharedDialogFields);

    switch (comp.type) {
        case 'Ground':
            content.appendChild(createElement('p', { className: 'hint', textContent: '接地元件用于指定 0V 参考节点。' }));
            break;
        case 'Switch':
            content.appendChild(createSwitchToggleGroup(comp.closed));
            break;
        default:
            if (!renderSharedDialogFields()) {
                content.appendChild(createElement('p', { className: 'hint', textContent: '该元件暂无可编辑参数。' }));
            }
    }

    safeRemoveClass(dialog, 'hidden');

    for (const field of sharedDialogFields) {
        if (field.kind !== 'slider') continue;
        const slider = document.getElementById(field.id);
        const valueEl = field.valueId ? document.getElementById(field.valueId) : null;
        if (slider && valueEl) {
            safeInvokeMethod(slider, 'addEventListener', 'input', () => {
                valueEl.textContent = `${Math.round(Number(slider.value) || 0)}%`;
            });
        }
    }

    const switchOpen = document.getElementById('switch-open');
    const switchClose = document.getElementById('switch-close');
    if (switchOpen && switchClose) {
        safeInvokeMethod(switchOpen, 'addEventListener', 'click', () => {
            safeAddClass(switchOpen, 'active');
            safeRemoveClass(switchClose, 'active');
        });
        safeInvokeMethod(switchClose, 'addEventListener', 'click', () => {
            safeAddClass(switchClose, 'active');
            safeRemoveClass(switchOpen, 'active');
        });
    }
}
