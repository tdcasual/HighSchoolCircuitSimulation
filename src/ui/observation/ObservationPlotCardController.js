export class ObservationPlotCardController {
    constructor({ onChange } = {}) {
        this.onChange = typeof onChange === 'function' ? onChange : () => {};
        this.disposeHandlers = [];
    }

    mount(elements = {}) {
        this.dispose();
        this.bindSelect(elements.xSourceSelect, () => ({
            type: 'plot-source-change',
            axis: 'x',
            value: elements.xSourceSelect.value
        }));
        this.bindSelect(elements.ySourceSelect, () => ({
            type: 'plot-source-change',
            axis: 'y',
            value: elements.ySourceSelect.value
        }));
        this.bindSelect(elements.xQuantitySelect, () => ({
            type: 'plot-quantity-change',
            axis: 'x',
            value: elements.xQuantitySelect.value
        }));
        this.bindSelect(elements.yQuantitySelect, () => ({
            type: 'plot-quantity-change',
            axis: 'y',
            value: elements.yQuantitySelect.value
        }));
        this.bindSelect(elements.xTransformSelect, () => ({
            type: 'plot-transform-change',
            axis: 'x',
            value: elements.xTransformSelect.value
        }));
        this.bindSelect(elements.yTransformSelect, () => ({
            type: 'plot-transform-change',
            axis: 'y',
            value: elements.yTransformSelect.value
        }));
        this.bindSelect(elements.yDisplaySelect, () => ({
            type: 'plot-display-change',
            axis: 'y',
            value: elements.yDisplaySelect.value
        }));
    }

    bindSelect(selectEl, payloadFactory) {
        if (!selectEl || typeof selectEl.addEventListener !== 'function') return;
        const handler = () => {
            const payload = payloadFactory();
            this.onChange(payload);
        };
        try {
            selectEl.addEventListener('change', handler);
        } catch (_) {
            return;
        }
        this.disposeHandlers.push(() => {
            if (typeof selectEl.removeEventListener === 'function') {
                try {
                    selectEl.removeEventListener('change', handler);
                } catch (_) {
                    // Ignore teardown errors from incomplete/mocked DOM targets.
                }
            }
        });
    }

    dispose() {
        this.disposeHandlers.forEach((fn) => fn());
        this.disposeHandlers = [];
    }
}
