import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ContextMenuController from '../src/ui/interaction/ContextMenuController.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function createFakeElement(tagName = 'div') {
    const listeners = new Map();
    return {
        tagName,
        id: '',
        className: '',
        textContent: '',
        style: {},
        children: [],
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        trigger(type, event = {}) {
            const handlers = listeners.get(type) || [];
            handlers.forEach((handler) => handler(event));
        },
        appendChild(child) {
            this.children.push(child);
        },
        remove: vi.fn()
    };
}

describe('ContextMenuController.hideContextMenu', () => {
    it('removes existing context menu and detaches click handler', () => {
        const remove = vi.fn();
        const menu = { remove };
        const removeEventListener = vi.fn();
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'context-menu' ? menu : null)),
            removeEventListener
        });
        const context = {
            hideContextMenuHandler: vi.fn()
        };

        ContextMenuController.hideContextMenu.call(context);

        expect(remove).toHaveBeenCalledTimes(1);
        expect(removeEventListener).toHaveBeenCalledWith('click', context.hideContextMenuHandler);
    });

    it('is no-op when context menu is absent', () => {
        const removeEventListener = vi.fn();
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            removeEventListener
        });
        const context = {
            hideContextMenuHandler: vi.fn()
        };

        ContextMenuController.hideContextMenu.call(context);

        expect(removeEventListener).not.toHaveBeenCalled();
    });
});

describe('ContextMenuController.showContextMenu', () => {
    it('renders default component menu items', () => {
        const appended = [];
        const body = { appendChild: vi.fn((el) => appended.push(el)) };
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            createElement: vi.fn(() => createFakeElement()),
            body,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });
        vi.stubGlobal('setTimeout', vi.fn((fn) => fn()));

        const context = {
            hideContextMenu: vi.fn(),
            hideContextMenuHandler: vi.fn(),
            circuit: { getComponent: vi.fn(() => ({ id: 'R1', type: 'Resistor' })) },
            showPropertyDialog: vi.fn(),
            rotateComponent: vi.fn(),
            duplicateComponent: vi.fn(),
            deleteComponent: vi.fn()
        };
        const event = { clientX: 12, clientY: 34 };

        ContextMenuController.showContextMenu.call(context, event, 'R1');

        expect(context.hideContextMenu).toHaveBeenCalledTimes(1);
        expect(appended).toHaveLength(1);
        const labels = appended[0].children.map((item) => item.textContent);
        expect(labels).toEqual(['关闭菜单', '编辑属性', '旋转 (R)', '复制', '删除 (Del)']);
    });
});

describe('ContextMenuController.showWireContextMenu', () => {
    it('renders wire menu including split and straighten actions', () => {
        const appended = [];
        const body = { appendChild: vi.fn((el) => appended.push(el)) };
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            createElement: vi.fn(() => createFakeElement()),
            body,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });
        vi.stubGlobal('setTimeout', vi.fn((fn) => fn()));

        const context = {
            hideContextMenu: vi.fn(),
            hideContextMenuHandler: vi.fn(),
            circuit: {
                getWire: vi.fn(() => ({
                    id: 'W1',
                    a: { x: 10, y: 20 },
                    b: { x: 120, y: 20 }
                }))
            },
            screenToCanvas: vi.fn(() => ({ x: 60, y: 20 })),
            splitWireAtPoint: vi.fn(),
            addObservationProbeForWire: vi.fn(),
            deleteWire: vi.fn(),
            runWithHistory: vi.fn(),
            renderer: { refreshWire: vi.fn() },
            updateStatus: vi.fn()
        };
        const event = { clientX: 60, clientY: 20 };

        ContextMenuController.showWireContextMenu.call(context, event, 'W1');

        expect(context.hideContextMenu).toHaveBeenCalledTimes(1);
        expect(appended).toHaveLength(1);
        const labels = appended[0].children.map((item) => item.textContent);
        expect(labels).toContain('在此处分割');
        expect(labels).toContain('拉直为水平');
        expect(labels).toContain('拉直为垂直');
        expect(labels).toContain('删除导线 (Del)');
    });

    it('blocks accidental quick touch tap on destructive wire delete', () => {
        const appended = [];
        const body = { appendChild: vi.fn((el) => appended.push(el)) };
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            createElement: vi.fn(() => createFakeElement()),
            body,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });
        vi.stubGlobal('setTimeout', vi.fn((fn) => fn()));

        const context = {
            hideContextMenu: vi.fn(),
            hideContextMenuHandler: vi.fn(),
            circuit: {
                getWire: vi.fn(() => ({
                    id: 'W1',
                    a: { x: 10, y: 20 },
                    b: { x: 120, y: 20 }
                }))
            },
            screenToCanvas: vi.fn(() => ({ x: 60, y: 20 })),
            splitWireAtPoint: vi.fn(),
            addObservationProbeForWire: vi.fn(),
            deleteWire: vi.fn(),
            runWithHistory: vi.fn(),
            renderer: { refreshWire: vi.fn() },
            updateStatus: vi.fn()
        };
        const event = { clientX: 60, clientY: 20 };

        ContextMenuController.showWireContextMenu.call(context, event, 'W1');
        context.hideContextMenu.mockClear();

        const menu = appended[0];
        const deleteItem = menu.children.find((item) => item.textContent === '删除导线 (Del)');
        expect(deleteItem).toBeTruthy();

        const quickDown = { pointerType: 'touch', clientX: 61, clientY: 21, timeStamp: 10 };
        const quickUp = { pointerType: 'touch', clientX: 62, clientY: 22, timeStamp: 70 };
        const quickClick = {
            pointerType: 'touch',
            clientX: 62,
            clientY: 22,
            timeStamp: 70,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
        };
        deleteItem.trigger('pointerdown', quickDown);
        deleteItem.trigger('pointerup', quickUp);
        deleteItem.trigger('click', quickClick);

        expect(context.deleteWire).not.toHaveBeenCalled();
        expect(context.hideContextMenu).not.toHaveBeenCalled();
        expect(context.updateStatus).toHaveBeenCalledTimes(1);
    });
});

describe('ContextMenuController.showProbeContextMenu', () => {
    it('renders probe menu items and optional select-wire action', () => {
        const appended = [];
        const body = { appendChild: vi.fn((el) => appended.push(el)) };
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => null),
            createElement: vi.fn(() => createFakeElement()),
            body,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });
        vi.stubGlobal('setTimeout', vi.fn((fn) => fn()));

        const context = {
            hideContextMenu: vi.fn(),
            hideContextMenuHandler: vi.fn(),
            selectedWire: 'W0',
            circuit: {
                getObservationProbe: vi.fn(() => ({ id: 'P1', wireId: 'W1' }))
            },
            renameObservationProbe: vi.fn(),
            addProbePlot: vi.fn(),
            deleteObservationProbe: vi.fn(),
            selectWire: vi.fn()
        };
        const event = { clientX: 10, clientY: 20 };

        ContextMenuController.showProbeContextMenu.call(context, event, 'P1', 'W1');

        expect(context.hideContextMenu).toHaveBeenCalledTimes(1);
        expect(appended).toHaveLength(1);
        const labels = appended[0].children.map((item) => item.textContent);
        expect(labels).toContain('选中所属导线');
        expect(labels).toContain('重命名探针');
        expect(labels).toContain('加入观察图像');
        expect(labels).toContain('删除探针');
    });
});
