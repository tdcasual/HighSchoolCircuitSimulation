import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExerciseBoard } from '../src/ui/ExerciseBoard.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ExerciseBoard.tryStartPanelDrag', () => {
    it('does not throw when target has no closest method', () => {
        const ctx = {
            panel: {},
            startPanelGesture: vi.fn()
        };
        const event = {
            pointerType: 'mouse',
            button: 0,
            target: {},
            preventDefault: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.tryStartPanelDrag.call(ctx, event)).not.toThrow();
        expect(ctx.startPanelGesture).toHaveBeenCalledWith('drag', event);
    });

    it('handleToolbarClick does not throw when target.closest is not callable', () => {
        const ctx = {
            wrapSelection: vi.fn(),
            prefixSelectedLines: vi.fn(),
            insertMathBlock: vi.fn(),
            insertLink: vi.fn()
        };
        const event = {
            target: { closest: {} },
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.handleToolbarClick.call(ctx, event)).not.toThrow();
        expect(ctx.wrapSelection).not.toHaveBeenCalled();
    });

    it('handleDocumentPointerDown tolerates contains errors and closes settings', () => {
        const ctx = {
            settingsPanel: {
                classList: {
                    contains: vi.fn(() => false)
                },
                contains: vi.fn(() => {
                    throw new TypeError('invalid target');
                })
            },
            settingsBtn: {
                contains: vi.fn(() => {
                    throw new TypeError('invalid target');
                })
            },
            setSettingsOpen: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.handleDocumentPointerDown.call(ctx, {
            target: { foo: 'bar' }
        })).not.toThrow();
        expect(ctx.setSettingsOpen).toHaveBeenCalledWith(false);
    });

    it('toggleSettings does not throw when classList.contains is not callable', () => {
        const ctx = {
            settingsPanel: {
                classList: {}
            },
            setSettingsOpen: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.toggleSettings.call(ctx)).not.toThrow();
        expect(ctx.setSettingsOpen).toHaveBeenCalledWith(true);
    });

    it('setSettingsOpen does not throw when classList.toggle is not callable', () => {
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        vi.stubGlobal('document', {
            addEventListener,
            removeEventListener
        });

        const ctx = {
            settingsPanel: {
                classList: {}
            },
            boundDocumentPointerDown: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.setSettingsOpen.call(ctx, true)).not.toThrow();
        expect(addEventListener).toHaveBeenCalledWith('pointerdown', ctx.boundDocumentPointerDown);
    });

    it('setSettingsOpen does not throw when document add/removeEventListener are non-callable', () => {
        vi.stubGlobal('document', {
            addEventListener: {},
            removeEventListener: {}
        });

        const ctx = {
            settingsPanel: {
                classList: {
                    toggle: vi.fn()
                }
            },
            boundDocumentPointerDown: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.setSettingsOpen.call(ctx, true)).not.toThrow();
        expect(() => ExerciseBoard.prototype.setSettingsOpen.call(ctx, false)).not.toThrow();
    });

    it('handleDocumentPointerDown does not throw when classList.contains is not callable', () => {
        const ctx = {
            settingsPanel: {
                classList: {}
            },
            settingsBtn: null,
            setSettingsOpen: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.handleDocumentPointerDown.call(ctx, {
            target: {}
        })).not.toThrow();
        expect(ctx.setSettingsOpen).toHaveBeenCalledWith(false);
    });

    it('renderNow falls back to escaped HTML when marked.parse is non-callable', () => {
        vi.stubGlobal('window', {
            marked: {
                parse: {}
            },
            MathJax: null
        });

        const ctx = {
            preview: { innerHTML: '' },
            previewInner: null,
            state: { mode: 'preview', markdown: '<tag>\nline2' },
            normalizeMode: (mode) => mode,
            escapeHtml: ExerciseBoard.prototype.escapeHtml,
            _typesetQueue: Promise.resolve()
        };

        expect(() => ExerciseBoard.prototype.renderNow.call(ctx)).not.toThrow();
        expect(ctx.preview.innerHTML).toBe('&lt;tag&gt;<br>line2');
    });

    it('renderNow does not throw when MathJax.typesetPromise is non-callable', () => {
        const parse = vi.fn(() => '<p>ok</p>');
        vi.stubGlobal('window', {
            marked: {
                parse
            },
            MathJax: {
                typesetPromise: {}
            }
        });

        const ctx = {
            preview: { innerHTML: '' },
            previewInner: null,
            state: { mode: 'preview', markdown: 'hello' },
            normalizeMode: (mode) => mode,
            escapeHtml: ExerciseBoard.prototype.escapeHtml,
            _typesetQueue: Promise.resolve()
        };

        expect(() => ExerciseBoard.prototype.renderNow.call(ctx)).not.toThrow();
        expect(parse).toHaveBeenCalledWith('hello', { breaks: true });
        expect(ctx.preview.innerHTML).toBe('<p>ok</p>');
    });

    it('startPanelGesture does not throw when panel classList.add is non-callable', () => {
        vi.stubGlobal('window', {
            addEventListener: vi.fn()
        });
        const panel = {
            getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20, width: 200, height: 120 })),
            style: { left: '10px', top: '20px' },
            classList: { add: {} }
        };
        const ctx = {
            panel,
            boundPanelPointerMove: vi.fn(),
            boundPanelPointerUp: vi.fn(),
            setPanelAbsolutePosition: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.startPanelGesture.call(ctx, 'drag', {
            pointerId: 1,
            clientX: 30,
            clientY: 40
        })).not.toThrow();
    });

    it('handlePanelPointerUp does not throw when panel classList.remove is non-callable', () => {
        vi.stubGlobal('window', {
            removeEventListener: vi.fn()
        });
        const ctx = {
            panelGesture: { pointerId: 1, type: 'drag' },
            boundPanelPointerMove: vi.fn(),
            boundPanelPointerUp: vi.fn(),
            panel: { classList: { remove: {} } },
            capturePanelLayout: vi.fn(),
            app: { scheduleSave: vi.fn() }
        };

        expect(() => ExerciseBoard.prototype.handlePanelPointerUp.call(ctx, {
            pointerId: 1
        })).not.toThrow();
    });

    it('applyStateToUI does not throw when classList.toggle is non-callable', () => {
        const ctx = {
            panel: { classList: { toggle: {} } },
            editor: { value: '', classList: { toggle: {} } },
            preview: { classList: { toggle: {} } },
            toolbar: { classList: { toggle: {} } },
            toolboxToggleBtn: { textContent: '' },
            modeBtn: { textContent: '' },
            state: {
                visible: true,
                mode: 'split',
                markdown: 'abc'
            },
            normalizeMode: ExerciseBoard.prototype.normalizeMode,
            applyTypographyToUI: vi.fn(),
            renderNow: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.applyStateToUI.call(ctx)).not.toThrow();
    });

    it('startPanelGesture does not throw when panel getBoundingClientRect is non-callable', () => {
        vi.stubGlobal('window', {
            addEventListener: vi.fn()
        });
        const panel = {
            getBoundingClientRect: {},
            style: { left: '10px', top: '20px' },
            classList: { add: vi.fn() }
        };
        const ctx = {
            panel,
            boundPanelPointerMove: vi.fn(),
            boundPanelPointerUp: vi.fn(),
            setPanelAbsolutePosition: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.startPanelGesture.call(ctx, 'drag', {
            pointerId: 1,
            clientX: 30,
            clientY: 40
        })).not.toThrow();
    });

    it('initializeContentControls does not throw when control addEventListener throws', () => {
        const ctx = {
            toolboxToggleBtn: {
                addEventListener: vi.fn(() => {
                    throw new TypeError('broken add');
                })
            }
        };

        expect(() => ExerciseBoard.prototype.initializeContentControls.call(ctx)).not.toThrow();
    });

    it('initializeLayoutControls does not throw when window addEventListener throws', () => {
        vi.stubGlobal('window', {
            addEventListener: vi.fn(() => {
                throw new TypeError('broken add');
            })
        });

        const ctx = {
            panel: { style: {} },
            panelHeader: null,
            resizeHandle: null,
            state: { layout: { left: 0, top: 0, width: 320, height: 240 } },
            getDefaultPanelLayout: vi.fn(() => ({ left: 0, top: 0, width: 320, height: 240 })),
            applyPanelLayout: vi.fn(),
            constrainPanelToViewport: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.initializeLayoutControls.call(ctx)).not.toThrow();
    });

    it('wrapSelection does not throw when editor focus throws', () => {
        const ctx = {
            editor: {
                value: 'abc',
                selectionStart: 0,
                selectionEnd: 3,
                focus: vi.fn(() => {
                    throw new TypeError('focus failed');
                })
            },
            onEditorProgrammaticChange: vi.fn()
        };

        expect(() => ExerciseBoard.prototype.wrapSelection.call(ctx, '**', '**', '加粗文字')).not.toThrow();
        expect(ctx.editor.value).toBe('**abc**');
        expect(ctx.onEditorProgrammaticChange).toHaveBeenCalledTimes(1);
    });
});
