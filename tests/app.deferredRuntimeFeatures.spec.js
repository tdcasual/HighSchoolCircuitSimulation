import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    createDeferredChartWorkspaceFacade,
    createDeferredExerciseBoardFacade,
    createDeferredClassroomModeFacade,
    createDeferredTopActionMenuFacade
} from '../src/app/DeferredRuntimeFeatures.js';

function createClassList(initial = []) {
    const tokens = new Set(initial);
    return {
        add: vi.fn((...classes) => {
            classes.forEach((name) => tokens.add(name));
        }),
        remove: vi.fn((...classes) => {
            classes.forEach((name) => tokens.delete(name));
        }),
        toggle: vi.fn((name, force) => {
            if (force === undefined) {
                if (tokens.has(name)) {
                    tokens.delete(name);
                    return false;
                }
                tokens.add(name);
                return true;
            }
            if (force) {
                tokens.add(name);
            } else {
                tokens.delete(name);
            }
            return !!force;
        }),
        contains: vi.fn((name) => tokens.has(name)),
        _tokens: tokens
    };
}

function matchesSelector(element, selector) {
    if (!element || typeof selector !== 'string' || !selector) return false;
    if (selector.startsWith('#')) {
        return element.id === selector.slice(1);
    }
    if (selector.startsWith('.')) {
        return element.classList.contains(selector.slice(1));
    }
    const [tagName, className] = selector.split('.');
    const tagMatches = !tagName || String(element.tagName || '').toLowerCase() === tagName.toLowerCase();
    const classMatches = !className || element.classList.contains(className);
    return tagMatches && classMatches;
}

function findFirstMatch(root, selector) {
    for (const child of root.children || []) {
        if (!child || typeof child !== 'object') continue;
        if (matchesSelector(child, selector)) return child;
        const nested = findFirstMatch(child, selector);
        if (nested) return nested;
    }
    return null;
}

function collectMatches(root, selector, results = []) {
    for (const child of root.children || []) {
        if (!child || typeof child !== 'object') continue;
        if (matchesSelector(child, selector)) {
            results.push(child);
        }
        collectMatches(child, selector, results);
    }
    return results;
}

function createFakeElement(tagName = 'div') {
    const listeners = new Map();
    const element = {
        tagName: String(tagName || 'div').toUpperCase(),
        id: '',
        children: [],
        style: {},
        dataset: {},
        attributes: {},
        classList: createClassList(),
        _className: '',
        _textContent: '',
        appendChild(child) {
            if (child && typeof child === 'object') {
                child.parentNode = this;
                this.children.push(child);
            }
            return child;
        },
        remove() {
            if (!this.parentNode?.children) return;
            const index = this.parentNode.children.indexOf(this);
            if (index >= 0) {
                this.parentNode.children.splice(index, 1);
            }
        },
        addEventListener: vi.fn((eventName, handler) => {
            listeners.set(eventName, handler);
        }),
        click() {
            const handler = listeners.get('click');
            handler?.({ currentTarget: this, target: this, preventDefault() {} });
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
            if (name === 'id') {
                this.id = String(value);
            }
        },
        getAttribute(name) {
            return this.attributes[name];
        },
        querySelector(selector) {
            return findFirstMatch(this, selector);
        },
        querySelectorAll(selector) {
            return collectMatches(this, selector, []);
        }
    };

    Object.defineProperty(element, 'className', {
        get() {
            return element._className;
        },
        set(value) {
            const next = String(value || '');
            element._className = next;
            element.classList._tokens.clear();
            next.split(/\s+/).filter(Boolean).forEach((name) => element.classList._tokens.add(name));
        }
    });

    Object.defineProperty(element, 'textContent', {
        get() {
            return element._textContent;
        },
        set(value) {
            element._textContent = String(value ?? '');
        }
    });

    return element;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('AppRuntimeV2 deferred runtime features', () => {
    it('keeps heavy UI controllers out of AppRuntimeV2 static imports', () => {
        const runtimePath = resolve(process.cwd(), 'src/app/AppRuntimeV2.js');
        const source = readFileSync(runtimePath, 'utf8');

        expect(source).not.toContain("from '../ui/charts/ChartWorkspaceController.js'");
        expect(source).not.toContain("from '../ui/ExerciseBoard.js'");
        expect(source).not.toContain("from '../ui/ClassroomModeController.js'");
        expect(source).not.toContain("from '../ui/ToolboxCategoryController.js'");
        expect(source).not.toContain("from '../ui/TopActionMenuController.js'");
        expect(source).not.toContain("from '../ui/FirstRunGuideController.js'");
        expect(source).not.toContain("from '../embed/EmbedRuntimeBridge.js'");
        expect(source).toContain('scheduleDeferredUiHydration');
        expect(source).toContain('createDeferredChartWorkspaceFacade');
    });

    it('exposes chart workspace facade with runtime-contract shape before hydration', () => {
        const facade = createDeferredChartWorkspaceFacade({});

        expect(Array.isArray(facade.windows)).toBe(true);
        expect(facade.windows.length).toBe(0);
        expect(facade.toJSON()).toEqual({ windows: [] });

        facade.fromJSON({ windows: [{ id: 'chart_1' }] });
        expect(facade.windows).toEqual([{ id: 'chart_1' }]);
    });

    it('mirrors observation touch contract before chart workspace hydration', () => {
        const root = createFakeElement('section');
        root.id = 'chart-workspace-root';
        const body = createFakeElement('body');
        const elementsById = new Map([
            ['chart-workspace-root', root]
        ]);

        vi.stubGlobal('document', {
            body,
            createElement: vi.fn((tagName) => createFakeElement(tagName)),
            getElementById: vi.fn((id) => elementsById.get(id) || null)
        });

        const facade = createDeferredChartWorkspaceFacade({});

        facade.onLayoutModeChanged('phone');
        expect(root.classList.contains('chart-workspace-phone')).toBe(true);
        expect(facade.isWindowDragEnabled()).toBe(false);
        expect(facade.isWindowResizeEnabled()).toBe(false);

        const firstWindow = facade.addChart();
        expect(firstWindow).toBeTruthy();
        expect(facade.windows).toHaveLength(1);
        expect(firstWindow.elements.root.querySelector('.chart-window-resizer-se')).toBeTruthy();
        expect(firstWindow.elements.root.classList.contains('chart-window-active')).toBe(true);

        const buttons = firstWindow.elements.root.querySelectorAll('button.chart-window-btn');
        const collapseButton = buttons.find((button) => {
            const text = String(button?.textContent || '').trim();
            return text === '收起图例' || text === '展开图例';
        });
        expect(collapseButton).toBeTruthy();

        const before = !!firstWindow.state.ui?.legendCollapsed;
        collapseButton.click();
        expect(firstWindow.state.ui.legendCollapsed).toBe(!before);
        expect(facade.toJSON().windows[0].uiState.collapsed).toBe(!before);
    });

    it('keeps exercise board and classroom placeholders serializable before hydration', () => {
        const exerciseBoard = createDeferredExerciseBoardFacade({});
        const classroomMode = createDeferredClassroomModeFacade({});
        const topActionMenu = createDeferredTopActionMenuFacade({});

        exerciseBoard.fromJSON({ chapter: 2, visible: true });
        expect(exerciseBoard.toJSON()).toMatchObject({ chapter: 2, visible: true });

        expect(classroomMode.activeLevel).toBe('off');
        const next = classroomMode.setPreferredLevel('enhanced');
        expect(next.activeLevel).toBe('enhanced');
        expect(classroomMode.activeLevel).toBe('enhanced');

        expect(() => topActionMenu.setOpen(false, { source: 'test' })).not.toThrow();
        expect(() => topActionMenu.sync()).not.toThrow();
    });

    it('syncs classroom bridge lock side effects before hydration', () => {
        const classButton = {
            hidden: false,
            disabled: false,
            textContent: '',
            title: '',
            setAttribute: vi.fn()
        };
        const endpointButton = {
            textContent: '',
            dataset: {},
            disabled: false,
            title: ''
        };
        const endpointNote = {
            textContent: '',
            hidden: true
        };
        const body = {
            classList: {
                toggle: vi.fn()
            }
        };

        vi.stubGlobal('document', {
            body,
            getElementById: vi.fn((id) => {
                if (id === 'btn-classroom-mode') return classButton;
                if (id === 'btn-mobile-endpoint-bridge-mode') return endpointButton;
                if (id === 'mobile-endpoint-bridge-note') return endpointNote;
                return null;
            })
        });
        vi.stubGlobal('window', { innerWidth: 1366 });

        const interaction = {
            endpointAutoBridgeMode: 'on',
            setEndpointAutoBridgeMode(mode) {
                this.endpointAutoBridgeMode = mode;
                endpointButton.textContent = mode === 'on' ? '端点补线: 总是开启' : (mode === 'off' ? '端点补线: 已关闭' : '端点补线: 手机自动');
                endpointButton.dataset.mode = mode;
                endpointButton.disabled = mode === 'off' && app.classroomMode.activeLevel !== 'off';
                endpointNote.hidden = app.classroomMode.activeLevel === 'off';
                if (!endpointNote.hidden) {
                    endpointButton.textContent = '端点补线: 课堂锁定';
                    endpointButton.title = '课堂模式下端点补线已锁定关闭';
                    endpointNote.textContent = '课堂模式已锁定端点补线为关闭';
                }
                return mode;
            },
            restoreEndpointAutoBridgeMode: vi.fn(() => 'on'),
            syncEndpointAutoBridgeButton: vi.fn()
        };
        const app = { interaction, responsiveLayout: { isOverlayMode: () => false } };
        app.classroomMode = createDeferredClassroomModeFacade(app);

        app.classroomMode.setPreferredLevel('standard');
        expect(interaction.endpointAutoBridgeMode).toBe('off');
        expect(app.classroomMode.activeLevel).toBe('standard');

        app.classroomMode.setPreferredLevel('off');
        expect(interaction.endpointAutoBridgeMode).toBe('on');
        expect(endpointButton.disabled).toBe(false);
        expect(endpointNote.hidden).toBe(true);
        expect(body.classList.toggle).toHaveBeenCalledWith('classroom-mode', true);
        expect(body.classList.toggle).toHaveBeenCalledWith('classroom-mode', false);
        expect(classButton.setAttribute).toHaveBeenCalledWith('data-classroom-level', 'standard');
        expect(classButton.setAttribute).toHaveBeenCalledWith('data-classroom-level', 'off');
    });
});
