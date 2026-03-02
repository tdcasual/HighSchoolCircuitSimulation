import { afterEach, describe, expect, it, vi } from 'vitest';
import * as PanelBindingsController from '../src/ui/interaction/PanelBindingsController.js';

function makeClickableElement() {
    const handlers = new Map();
    return {
        classList: {
            add: vi.fn(),
            remove: vi.fn()
        },
        addEventListener: vi.fn((eventName, handler) => {
            handlers.set(eventName, handler);
        }),
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        trigger: (eventName, event = {}) => {
            const handler = handlers.get(eventName);
            if (handler) handler(event);
        },
        triggerClick: () => {
            const clickHandler = handlers.get('click');
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

    it('wires mobile action buttons to existing handlers and exercise board trigger', () => {
        const runButton = makeClickableElement();
        const stopButton = makeClickableElement();
        const clearButton = makeClickableElement();
        const exportButton = makeClickableElement();
        const importButton = makeClickableElement();
        const mobileRunButton = makeClickableElement();
        const mobileStopButton = makeClickableElement();
        const mobileClearButton = makeClickableElement();
        const mobileExportButton = makeClickableElement();
        const mobileImportButton = makeClickableElement();
        const mobileModeSelectButton = makeClickableElement();
        const mobileModeWireButton = makeClickableElement();
        const endpointBridgeModeButton = makeClickableElement();
        const mobileExerciseButton = makeClickableElement();
        const desktopExerciseButton = {
            click: vi.fn(),
            addEventListener: vi.fn()
        };
        const fileImport = {
            addEventListener: vi.fn(),
            click: vi.fn()
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': runButton,
                'btn-stop': stopButton,
                'btn-clear': clearButton,
                'btn-export': exportButton,
                'btn-import': importButton,
                'btn-mobile-run': mobileRunButton,
                'btn-mobile-stop': mobileStopButton,
                'btn-mobile-clear': mobileClearButton,
                'btn-mobile-export': mobileExportButton,
                'btn-mobile-import': mobileImportButton,
                'btn-mobile-mode-select': mobileModeSelectButton,
                'btn-mobile-mode-wire': mobileModeWireButton,
                'btn-mobile-endpoint-bridge-mode': endpointBridgeModeButton,
                'btn-mobile-exercise-board': mobileExerciseButton,
                'btn-exercise-board': desktopExerciseButton,
                'file-import': fileImport,
                'dialog-cancel': makeClickableElement(),
                'dialog-ok': makeClickableElement(),
                'dialog-overlay': { addEventListener: vi.fn() }
            }[id]))
        });
        vi.stubGlobal('confirm', vi.fn(() => true));

        const context = {
            app: {
                startSimulation: vi.fn(),
                stopSimulation: vi.fn(),
                clearCircuit: vi.fn(),
                exportCircuit: vi.fn(),
                importCircuit: vi.fn()
            },
            setMobileInteractionMode: vi.fn(),
            cycleEndpointAutoBridgeMode: vi.fn(),
            restoreEndpointAutoBridgeMode: vi.fn(),
            hideDialog: vi.fn(),
            applyDialogChanges: vi.fn()
        };

        PanelBindingsController.bindButtonEvents.call(context);

        mobileRunButton.triggerClick();
        mobileStopButton.triggerClick();
        mobileClearButton.triggerClick();
        mobileExportButton.triggerClick();
        mobileImportButton.triggerClick();
        mobileModeSelectButton.triggerClick();
        mobileModeWireButton.triggerClick();
        endpointBridgeModeButton.triggerClick();
        mobileExerciseButton.triggerClick();

        expect(context.app.startSimulation).toHaveBeenCalledTimes(1);
        expect(context.app.stopSimulation).toHaveBeenCalledTimes(1);
        expect(context.app.clearCircuit).toHaveBeenCalledTimes(1);
        expect(context.app.exportCircuit).toHaveBeenCalledTimes(1);
        expect(fileImport.click).toHaveBeenCalledTimes(1);
        expect(context.setMobileInteractionMode).toHaveBeenNthCalledWith(1, 'select');
        expect(context.setMobileInteractionMode).toHaveBeenNthCalledWith(2, 'wire');
        expect(context.cycleEndpointAutoBridgeMode).toHaveBeenCalledTimes(1);
        expect(context.restoreEndpointAutoBridgeMode).toHaveBeenCalledWith({ silentStatus: true });
        expect(desktopExerciseButton.click).toHaveBeenCalledTimes(1);
    });

    it('requires long press for touch clear action and suppresses accidental tap', () => {
        const clearButton = makeClickableElement();
        const fileImport = {
            addEventListener: vi.fn(),
            click: vi.fn()
        };

        vi.useFakeTimers();
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': makeClickableElement(),
                'btn-stop': makeClickableElement(),
                'btn-clear': clearButton,
                'btn-export': makeClickableElement(),
                'btn-import': makeClickableElement(),
                'file-import': fileImport,
                'dialog-cancel': makeClickableElement(),
                'dialog-ok': makeClickableElement(),
                'dialog-overlay': { addEventListener: vi.fn() }
            }[id]))
        });
        const confirmMock = vi.fn(() => true);
        vi.stubGlobal('confirm', confirmMock);

        const context = {
            app: {
                startSimulation: vi.fn(),
                stopSimulation: vi.fn(),
                clearCircuit: vi.fn(),
                exportCircuit: vi.fn(),
                importCircuit: vi.fn()
            },
            updateStatus: vi.fn(),
            hideDialog: vi.fn(),
            applyDialogChanges: vi.fn()
        };

        PanelBindingsController.bindButtonEvents.call(context);

        clearButton.trigger('pointerdown', {
            pointerType: 'touch',
            pointerId: 11,
            clientX: 24,
            clientY: 30
        });
        vi.advanceTimersByTime(120);
        clearButton.trigger('pointerup', {
            pointerType: 'touch',
            pointerId: 11,
            clientX: 24,
            clientY: 30
        });
        clearButton.trigger('click', { preventDefault: vi.fn() });

        expect(context.app.clearCircuit).not.toHaveBeenCalled();
        expect(confirmMock).not.toHaveBeenCalled();
        expect(context.updateStatus).toHaveBeenCalledWith(expect.stringContaining('长按'));

        clearButton.trigger('pointerdown', {
            pointerType: 'touch',
            pointerId: 12,
            clientX: 24,
            clientY: 30
        });
        vi.advanceTimersByTime(380);
        expect(context.app.clearCircuit).toHaveBeenCalledTimes(1);
        clearButton.trigger('pointerup', {
            pointerType: 'touch',
            pointerId: 12,
            clientX: 24,
            clientY: 30
        });
        clearButton.trigger('click', { preventDefault: vi.fn() });
        expect(context.app.clearCircuit).toHaveBeenCalledTimes(1);
        expect(confirmMock).not.toHaveBeenCalled();
    });

    it('does not throw when optional file import and dialog overlay nodes are absent', () => {
        const runButton = makeClickableElement();
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': runButton
            }[id] || null))
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

        expect(() => PanelBindingsController.bindButtonEvents.call(context)).not.toThrow();
        runButton.triggerClick();
        expect(context.app.startSimulation).toHaveBeenCalledTimes(1);
    });

    it('does not throw when file-import or exercise-board click is non-callable', () => {
        const mobileImportButton = makeClickableElement();
        const mobileExerciseButton = makeClickableElement();
        const fileImport = {
            addEventListener: vi.fn(),
            click: {}
        };
        const desktopExerciseButton = {
            addEventListener: vi.fn(),
            click: {}
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-mobile-import': mobileImportButton,
                'btn-mobile-exercise-board': mobileExerciseButton,
                'file-import': fileImport,
                'btn-exercise-board': desktopExerciseButton
            }[id] || null))
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
        expect(() => mobileImportButton.triggerClick()).not.toThrow();
        expect(() => mobileExerciseButton.triggerClick()).not.toThrow();
    });

    it('touch clear hold does not throw when classList add/remove throw', () => {
        const clearButton = makeClickableElement();
        clearButton.classList.add = vi.fn(() => {
            throw new TypeError('broken add');
        });
        clearButton.classList.remove = vi.fn(() => {
            throw new TypeError('broken remove');
        });
        const fileImport = {
            addEventListener: vi.fn(),
            click: vi.fn()
        };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': makeClickableElement(),
                'btn-stop': makeClickableElement(),
                'btn-clear': clearButton,
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
            updateStatus: vi.fn(),
            hideDialog: vi.fn(),
            applyDialogChanges: vi.fn()
        };

        PanelBindingsController.bindButtonEvents.call(context);
        expect(() => clearButton.trigger('pointerdown', {
            pointerType: 'touch',
            pointerId: 21,
            clientX: 20,
            clientY: 20
        })).not.toThrow();
        expect(() => clearButton.trigger('pointerup', {
            pointerType: 'touch',
            pointerId: 21,
            clientX: 20,
            clientY: 20
        })).not.toThrow();
    });

    it('does not throw when button addEventListener throws during bindClick wiring', () => {
        const runButton = {
            addEventListener: vi.fn(() => {
                throw new TypeError('broken add');
            })
        };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': runButton
            }[id] || null))
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

        expect(() => PanelBindingsController.bindButtonEvents.call(context)).not.toThrow();
    });

    it('does not throw when clear button addEventListener throws during hold-gesture wiring', () => {
        const clearButton = {
            addEventListener: vi.fn(() => {
                throw new TypeError('broken add');
            })
        };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': makeClickableElement(),
                'btn-clear': clearButton
            }[id] || null))
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

        expect(() => PanelBindingsController.bindButtonEvents.call(context)).not.toThrow();
    });

    it('does not throw when file import and dialog overlay addEventListener throw', () => {
        const fileImport = {
            addEventListener: vi.fn(() => {
                throw new TypeError('broken add');
            }),
            click: vi.fn()
        };
        const dialogOverlay = {
            addEventListener: vi.fn(() => {
                throw new TypeError('broken add');
            })
        };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'btn-run': makeClickableElement(),
                'file-import': fileImport,
                'dialog-overlay': dialogOverlay
            }[id] || null))
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

        expect(() => PanelBindingsController.bindButtonEvents.call(context)).not.toThrow();
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

    it('does not throw when tab/page methods are non-callable', () => {
        const btnProperty = {
            dataset: { panel: 'property' },
            classList: { toggle: {} },
            setAttribute: {},
            addEventListener: {}
        };
        const btnObservation = {
            dataset: { panel: 'observation' },
            classList: { toggle: {} },
            setAttribute: {},
            addEventListener: {}
        };
        const pageProperty = {
            dataset: { panel: 'property' },
            id: 'panel-property',
            classList: { toggle: {} },
            setAttribute: {}
        };
        const pageObservation = {
            dataset: { panel: 'observation' },
            id: 'panel-observation',
            classList: { toggle: {} },
            setAttribute: {}
        };

        vi.stubGlobal('document', {
            querySelectorAll: vi.fn((selector) => {
                if (selector === '.panel-tab-btn') return [btnProperty, btnObservation];
                if (selector === '.panel-page') return [pageProperty, pageObservation];
                return [];
            })
        });

        const context = {};
        expect(() => PanelBindingsController.bindSidePanelEvents.call(context)).not.toThrow();
        expect(typeof context.activateSidePanelTab).toBe('function');
        expect(() => context.activateSidePanelTab('observation')).not.toThrow();
    });
});
