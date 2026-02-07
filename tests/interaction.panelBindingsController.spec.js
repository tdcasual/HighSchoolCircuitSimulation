import { afterEach, describe, expect, it, vi } from 'vitest';
import * as PanelBindingsController from '../src/ui/interaction/PanelBindingsController.js';

function makeClickableElement() {
    let clickHandler = null;
    return {
        addEventListener: vi.fn((eventName, handler) => {
            if (eventName === 'click') {
                clickHandler = handler;
            }
        }),
        triggerClick: () => {
            if (clickHandler) clickHandler();
        }
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('PanelBindingsController.bindButtonEvents', () => {
    it('binds run and stop buttons to app simulation controls', () => {
        const runButton = makeClickableElement();
        const stopButton = makeClickableElement();
        const clearButton = makeClickableElement();
        const exportButton = makeClickableElement();
        const importButton = makeClickableElement();
        const fileImport = {
            addEventListener: vi.fn(),
            click: vi.fn()
        };
        const dialogCancel = makeClickableElement();
        const dialogOk = makeClickableElement();
        const dialogOverlay = {
            addEventListener: vi.fn()
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': runButton,
                'btn-stop': stopButton,
                'btn-clear': clearButton,
                'btn-export': exportButton,
                'btn-import': importButton,
                'file-import': fileImport,
                'dialog-cancel': dialogCancel,
                'dialog-ok': dialogOk,
                'dialog-overlay': dialogOverlay
            }[id]))
        });
        vi.stubGlobal('confirm', vi.fn(() => false));

        const context = {
            app: {
                startSimulation: vi.fn(),
                stopSimulation: vi.fn(),
                clearCircuit: vi.fn(),
                exportCircuit: vi.fn(),
                importCircuit: vi.fn()
            },
            hideDialog: vi.fn(),
            applyDialogChanges: vi.fn()
        };

        PanelBindingsController.bindButtonEvents.call(context);
        runButton.triggerClick();
        stopButton.triggerClick();

        expect(context.app.startSimulation).toHaveBeenCalledTimes(1);
        expect(context.app.stopSimulation).toHaveBeenCalledTimes(1);
    });

    it('imports selected file and resets input value', () => {
        let changeHandler = null;
        const fileImport = {
            addEventListener: vi.fn((eventName, handler) => {
                if (eventName === 'change') changeHandler = handler;
            }),
            click: vi.fn()
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': makeClickableElement(),
                'btn-stop': makeClickableElement(),
                'btn-clear': makeClickableElement(),
                'btn-export': makeClickableElement(),
                'btn-import': makeClickableElement(),
                'file-import': fileImport,
                'dialog-cancel': makeClickableElement(),
                'dialog-ok': makeClickableElement(),
                'dialog-overlay': { addEventListener: vi.fn() }
            }[id]))
        });
        vi.stubGlobal('confirm', vi.fn(() => false));

        const context = {
            app: {
                startSimulation: vi.fn(),
                stopSimulation: vi.fn(),
                clearCircuit: vi.fn(),
                exportCircuit: vi.fn(),
                importCircuit: vi.fn()
            },
            hideDialog: vi.fn(),
            applyDialogChanges: vi.fn()
        };

        PanelBindingsController.bindButtonEvents.call(context);

        const inputEvent = {
            target: {
                files: [{ name: 'sample.json' }],
                value: 'C:\\fakepath\\sample.json'
            }
        };
        changeHandler(inputEvent);

        expect(context.app.importCircuit).toHaveBeenCalledWith(expect.objectContaining({ name: 'sample.json' }));
        expect(inputEvent.target.value).toBe('');
    });
});

describe('PanelBindingsController.bindSidePanelEvents', () => {
    it('binds tab click and toggles active states', () => {
        const btnProperty = {
            dataset: { panel: 'property' },
            classList: { toggle: vi.fn() },
            setAttribute: vi.fn(),
            addEventListener: vi.fn()
        };
        const btnObservation = {
            dataset: { panel: 'observation' },
            classList: { toggle: vi.fn() },
            setAttribute: vi.fn(),
            addEventListener: vi.fn()
        };
        const pageProperty = {
            dataset: { panel: 'property' },
            id: 'panel-property',
            classList: { toggle: vi.fn() },
            setAttribute: vi.fn()
        };
        const pageObservation = {
            dataset: { panel: 'observation' },
            id: 'panel-observation',
            classList: { toggle: vi.fn() },
            setAttribute: vi.fn()
        };

        vi.stubGlobal('document', {
            querySelectorAll: vi.fn((selector) => {
                if (selector === '.panel-tab-btn') return [btnProperty, btnObservation];
                if (selector === '.panel-page') return [pageProperty, pageObservation];
                return [];
            })
        });

        const context = {};
        PanelBindingsController.bindSidePanelEvents.call(context);

        const observationClickHandler = btnObservation.addEventListener.mock.calls[0][1];
        observationClickHandler();

        expect(btnObservation.classList.toggle).toHaveBeenCalledWith('active', true);
        expect(btnProperty.classList.toggle).toHaveBeenCalledWith('active', false);
        expect(pageObservation.classList.toggle).toHaveBeenCalledWith('active', true);
        expect(pageObservation.setAttribute).toHaveBeenCalledWith('aria-hidden', 'false');
        expect(typeof context.activateSidePanelTab).toBe('function');
    });
});
