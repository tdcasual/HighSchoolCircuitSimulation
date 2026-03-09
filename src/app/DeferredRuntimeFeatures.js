import { safeInvoke } from '../utils/RuntimeSafety.js';

function normalizeDeferredClassroomLevel(level) {
    const text = String(level || '').trim().toLowerCase();
    if (text === 'standard' || text === 'enhanced' || text === 'off') {
        return text;
    }
    return 'off';
}

function scheduleTask(task) {
    if (typeof queueMicrotask === 'function') {
        queueMicrotask(task);
        return;
    }
    Promise.resolve().then(task);
}

function hydrateDeferredController(currentValue, controller) {
    if (currentValue && typeof currentValue.__hydrateController === 'function') {
        return currentValue.__hydrateController(controller);
    }
    return controller;
}

const safeInvokeMethod = (target, methodName, ...args) => safeInvoke(target, methodName, args);

function isDeferredClassroomSupported(app) {
    if (typeof window === 'undefined') return true;
    const overlayMode = !!app?.responsiveLayout?.isOverlayMode?.();
    return (window.innerWidth || 0) > 900 && !overlayMode;
}

function syncDeferredClassroomBodyClass(activeLevel) {
    const body = typeof document !== 'undefined' ? document.body : null;
    safeInvokeMethod(body?.classList, 'toggle', 'classroom-mode', activeLevel !== 'off');
    safeInvokeMethod(body?.classList, 'toggle', 'classroom-mode-enhanced', activeLevel === 'enhanced');
}

function syncDeferredClassroomButton(preferredLevel, supported) {
    if (typeof document === 'undefined') return;
    const button = document.getElementById('btn-classroom-mode');
    if (!button) return;

    button.hidden = !supported;
    button.disabled = !supported;
    safeInvokeMethod(button, 'setAttribute', 'aria-pressed', preferredLevel === 'off' ? 'false' : 'true');
    safeInvokeMethod(button, 'setAttribute', 'data-classroom-level', preferredLevel);

    if (preferredLevel === 'standard') {
        button.textContent = '课堂模式: 标准';
        button.title = '课堂模式标准（点击切换到增强）';
        return;
    }
    if (preferredLevel === 'enhanced') {
        button.textContent = '课堂模式: 增强';
        button.title = '课堂模式增强（点击关闭）';
        return;
    }
    button.textContent = '课堂模式: 关';
    button.title = '开启课堂模式（标准）';
}

function syncDeferredClassroomInteraction(app, state) {
    const interaction = app?.interaction;
    if (!interaction) return;

    const setMode = typeof interaction.setEndpointAutoBridgeMode === 'function'
        ? interaction.setEndpointAutoBridgeMode.bind(interaction)
        : null;
    const restoreMode = typeof interaction.restoreEndpointAutoBridgeMode === 'function'
        ? interaction.restoreEndpointAutoBridgeMode.bind(interaction)
        : null;
    const syncButton = typeof interaction.syncEndpointAutoBridgeButton === 'function'
        ? interaction.syncEndpointAutoBridgeButton.bind(interaction)
        : null;

    if (state.activeLevel !== 'off') {
        if (state.savedEndpointAutoBridgeMode === null) {
            const currentMode = String(interaction.endpointAutoBridgeMode || '').trim().toLowerCase();
            state.savedEndpointAutoBridgeMode = currentMode || 'auto';
        }
        if (setMode) {
            setMode('off', { persist: false, silentStatus: true });
        } else {
            interaction.endpointAutoBridgeMode = 'off';
            syncButton?.();
        }
        return;
    }

    if (state.savedEndpointAutoBridgeMode !== null) {
        const restoreValue = state.savedEndpointAutoBridgeMode;
        state.savedEndpointAutoBridgeMode = null;
        if (setMode) {
            setMode(restoreValue, { persist: false, silentStatus: true });
        } else {
            interaction.endpointAutoBridgeMode = restoreValue;
            syncButton?.();
        }
        return;
    }

    if (restoreMode) {
        restoreMode({ silentStatus: true });
        return;
    }

    syncButton?.();
}

export function createDeferredChartWorkspaceFacade() {
    const state = {
        windows: [],
        rawState: { windows: [] },
        runtimeStatus: '',
        layoutMode: '',
        lastCircuitUpdate: null,
        pendingSourcePlots: [],
        needsRender: false,
        needsDialRefresh: false,
        needsComponentOptionsRefresh: false,
        clearRequested: false,
        nextWindowId: 1
    };

    function ensureRawWindows() {
        const rawWindows = Array.isArray(state.rawState?.windows) ? state.rawState.windows : [];
        if (state.rawState?.windows !== rawWindows) {
            state.rawState = {
                ...(state.rawState || {}),
                windows: rawWindows
            };
        }
        return rawWindows;
    }

    function syncWorkspaceRootClass() {
        if (typeof document === 'undefined') return;
        const root = document.getElementById('chart-workspace-root');
        safeInvokeMethod(root?.classList, 'toggle', 'chart-workspace-phone', state.layoutMode === 'phone');
    }

    function createWorkspaceElement(tagName = 'div', className = '', textContent = '') {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
            return null;
        }
        const element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        if (textContent) {
            element.textContent = textContent;
        }
        return element;
    }

    function syncPlaceholderLegendState(windowRecord) {
        if (!windowRecord?.rawWindow || !windowRecord?.state?.ui) return;
        const collapsed = !!windowRecord.state.ui.legendCollapsed;
        windowRecord.rawWindow.uiState = {
            ...(windowRecord.rawWindow.uiState || {}),
            collapsed
        };
        safeInvokeMethod(windowRecord.elements?.root?.classList, 'toggle', 'chart-window-legend-collapsed', collapsed);
        if (windowRecord.elements?.legendToggleBtn) {
            windowRecord.elements.legendToggleBtn.textContent = collapsed ? '展开图例' : '收起图例';
            safeInvokeMethod(
                windowRecord.elements.legendToggleBtn,
                'setAttribute',
                'aria-expanded',
                collapsed ? 'false' : 'true'
            );
        }
    }

    function focusPlaceholderWindow(targetWindow) {
        state.windows.forEach((windowRecord) => {
            safeInvokeMethod(windowRecord?.elements?.root?.classList, 'toggle', 'chart-window-active', windowRecord === targetWindow);
        });
    }

    function mountPlaceholderWindow(windowRecord) {
        const workspaceRoot = typeof document !== 'undefined'
            ? document.getElementById('chart-workspace-root')
            : null;
        if (!workspaceRoot) {
            return windowRecord;
        }

        const root = createWorkspaceElement('section', 'chart-window chart-window-v2');
        if (!root) {
            return windowRecord;
        }
        safeInvokeMethod(root, 'setAttribute', 'data-chart-window-id', windowRecord.id);

        const header = createWorkspaceElement('div', 'chart-window-header');
        const legendToggleBtn = createWorkspaceElement('button', 'chart-window-btn');
        safeInvokeMethod(legendToggleBtn, 'setAttribute', 'type', 'button');
        safeInvokeMethod(legendToggleBtn, 'addEventListener', 'click', () => {
            windowRecord.state.ui.legendCollapsed = !windowRecord.state.ui.legendCollapsed;
            syncPlaceholderLegendState(windowRecord);
        });
        safeInvokeMethod(header, 'appendChild', legendToggleBtn);

        const resizers = createWorkspaceElement('div', 'chart-window-resizers');
        const resizeHandle = createWorkspaceElement('div', 'chart-window-resizer chart-window-resizer-se');
        safeInvokeMethod(resizeHandle, 'setAttribute', 'data-resize-dir', 'se');
        safeInvokeMethod(resizers, 'appendChild', resizeHandle);

        safeInvokeMethod(root, 'appendChild', header);
        safeInvokeMethod(root, 'appendChild', resizers);
        safeInvokeMethod(root, 'addEventListener', 'pointerdown', () => focusPlaceholderWindow(windowRecord));
        safeInvokeMethod(workspaceRoot, 'appendChild', root);

        windowRecord.elements = {
            root,
            header,
            legendToggleBtn,
            resizers
        };
        syncPlaceholderLegendState(windowRecord);
        focusPlaceholderWindow(windowRecord);
        return windowRecord;
    }

    function resolveLegendCollapsed(options = {}) {
        if (Object.prototype.hasOwnProperty.call(options.ui || {}, 'legendCollapsed')) {
            return !!options.ui.legendCollapsed;
        }
        return state.layoutMode === 'phone';
    }

    function createPlaceholderWindowRecord(options = {}) {
        const rawOptions = options && typeof options === 'object' ? options : {};
        const rawWindows = ensureRawWindows();
        const index = rawWindows.length + 1;
        const id = 'chart_' + state.nextWindowId++;
        const legendCollapsed = resolveLegendCollapsed(rawOptions);
        const title = typeof rawOptions.title === 'string' && rawOptions.title.trim()
            ? rawOptions.title.trim()
            : '图表 ' + index;
        const rawWindow = {
            id,
            title,
            rect: rawOptions.frame ? { ...rawOptions.frame } : undefined,
            zIndex: index,
            maxPoints: rawOptions.maxPoints,
            uiState: {
                collapsed: legendCollapsed
            }
        };
        const windowRecord = {
            id,
            rawWindow,
            state: {
                id,
                title,
                zIndex: index,
                frame: rawWindow.rect,
                ui: {
                    axisCollapsed: false,
                    legendCollapsed
                }
            },
            elements: {
                root: null,
                header: null,
                legendToggleBtn: null,
                resizers: null
            }
        };
        rawWindows.push(rawWindow);
        state.windows = [...state.windows, windowRecord];
        state.nextWindowId = Math.max(state.nextWindowId, rawWindows.length + 1);
        return mountPlaceholderWindow(windowRecord);
    }

    function disposePlaceholderWindows() {
        state.windows.forEach((windowRecord) => {
            safeInvokeMethod(windowRecord?.elements?.root, 'remove');
        });
    }

    return {
        windows: state.windows,
        toJSON() {
            return state.rawState;
        },
        fromJSON(rawState = {}) {
            const nextState = rawState && typeof rawState === 'object' ? { ...rawState } : {};
            const rawWindows = Array.isArray(nextState.windows) ? [...nextState.windows] : [];
            nextState.windows = rawWindows;
            state.rawState = nextState;
            state.windows = [...rawWindows];
            state.nextWindowId = rawWindows.length + 1;
            this.windows = state.windows;
            syncWorkspaceRootClass();
            return true;
        },
        setRuntimeStatus(message = '') {
            state.runtimeStatus = String(message || '');
            return true;
        },
        isWindowDragEnabled() {
            return state.layoutMode !== 'phone';
        },
        isWindowResizeEnabled() {
            return state.layoutMode !== 'phone';
        },
        onLayoutModeChanged(mode = 'desktop') {
            state.layoutMode = String(mode || 'desktop');
            syncWorkspaceRootClass();
            return true;
        },
        onCircuitUpdate(results) {
            state.lastCircuitUpdate = results || null;
            return true;
        },
        refreshComponentOptions() {
            state.needsComponentOptionsRefresh = true;
            return true;
        },
        refreshDialGauges() {
            state.needsDialRefresh = true;
            return true;
        },
        requestRender() {
            state.needsRender = true;
            return true;
        },
        clearAllPlots() {
            state.clearRequested = true;
            disposePlaceholderWindows();
            state.windows = [];
            state.rawState = {
                ...state.rawState,
                windows: []
            };
            this.windows = state.windows;
            return true;
        },
        addPlotForSource(sourceId, options = {}) {
            state.pendingSourcePlots.push([sourceId, options]);
            return null;
        },
        addChart(options = {}) {
            const windowRecord = createPlaceholderWindowRecord(options);
            this.windows = state.windows;
            return windowRecord;
        },
        addWindow(options = {}) {
            return this.addChart(options);
        },
        __hydrateController(controller) {
            if (state.rawState) {
                controller.fromJSON?.(state.rawState);
            }
            if (state.layoutMode) {
                controller.onLayoutModeChanged?.(state.layoutMode);
            }
            if (state.clearRequested) {
                controller.clearAllPlots?.();
            }
            for (const [sourceId, options] of state.pendingSourcePlots) {
                controller.addPlotForSource?.(sourceId, options);
            }
            if (state.runtimeStatus) {
                controller.setRuntimeStatus?.(state.runtimeStatus);
            }
            if (state.lastCircuitUpdate) {
                controller.onCircuitUpdate?.(state.lastCircuitUpdate);
            }
            if (state.needsComponentOptionsRefresh) {
                controller.refreshComponentOptions?.();
            }
            if (state.needsDialRefresh) {
                controller.refreshDialGauges?.();
            }
            if (state.needsRender) {
                controller.requestRender?.();
            }
            return controller;
        }
    };
}

export function createDeferredExerciseBoardFacade() {
    const state = {
        rawState: undefined,
        lastAction: 'none'
    };

    return {
        toJSON() {
            return state.rawState;
        },
        fromJSON(rawState = {}) {
            state.rawState = rawState && typeof rawState === 'object' ? { ...rawState } : {};
            state.lastAction = 'fromJSON';
            return true;
        },
        reset() {
            state.rawState = undefined;
            state.lastAction = 'reset';
            return true;
        },
        __hydrateController(controller) {
            if (state.lastAction === 'reset') {
                controller.reset?.();
                return controller;
            }
            if (state.lastAction === 'fromJSON' && state.rawState !== undefined) {
                controller.fromJSON?.(state.rawState);
            }
            return controller;
        }
    };
}

export function createDeferredClassroomModeFacade(app = null) {
    const state = {
        activeLevel: 'off',
        savedEndpointAutoBridgeMode: null
    };

    return {
        activeLevel: state.activeLevel,
        setPreferredLevel(level, _options = {}) {
            const nextLevel = normalizeDeferredClassroomLevel(level);
            state.activeLevel = nextLevel;
            this.activeLevel = nextLevel;

            const supported = isDeferredClassroomSupported(app);
            syncDeferredClassroomBodyClass(supported ? nextLevel : 'off');
            syncDeferredClassroomButton(nextLevel, supported);
            syncDeferredClassroomInteraction(app, state);

            return {
                preferredLevel: nextLevel,
                activeLevel: supported ? nextLevel : 'off',
                supported
            };
        },
        __hydrateController(controller) {
            if (state.activeLevel !== 'off') {
                controller.setPreferredLevel?.(state.activeLevel, {
                    persist: false,
                    announce: false
                });
            }
            return controller;
        }
    };
}

export function createDeferredTopActionMenuFacade() {
    const state = {
        open: false,
        selectionMode: 'none'
    };

    return {
        setOpen(nextOpen, _options = {}) {
            state.open = !!nextOpen;
            return state.open;
        },
        sync() {
            return true;
        },
        setSelectionMode(mode = 'none') {
            state.selectionMode = String(mode || 'none');
            return state.selectionMode;
        },
        __hydrateController(controller) {
            controller.setSelectionMode?.(state.selectionMode);
            controller.setOpen?.(state.open, { source: 'deferred-hydration' });
            controller.sync?.();
            return controller;
        }
    };
}

export function createDeferredToolboxCategoryFacade() {
    return {
        __hydrateController(controller) {
            return controller;
        }
    };
}

export function createDeferredFirstRunGuideFacade(_app, options = {}) {
    const state = {
        showRequested: false,
        enabled: options.enabled !== false
    };

    return {
        setEnabled(nextEnabled) {
            state.enabled = nextEnabled !== false;
            return state.enabled;
        },
        show(options = {}) {
            if (options.force === true) {
                state.showRequested = true;
                return true;
            }
            if (!state.enabled) return false;
            state.showRequested = true;
            return true;
        },
        maybeShow() {
            if (!state.enabled) return false;
            state.showRequested = true;
            return true;
        },
        __hydrateController(controller) {
            controller.setEnabled?.(state.enabled);
            if (state.showRequested) {
                controller.maybeShow?.();
            }
            return controller;
        }
    };
}

export function createDeferredEmbedBridgePlaceholder() {
    return {
        enabled: false,
        initialize() {
            return false;
        }
    };
}

export async function scheduleDeferredUiHydration(app) {
    if (!app || app.runtimeOptions?.enabled) {
        return Promise.resolve(null);
    }
    if (app.deferredUiHydrationPromise) {
        return app.deferredUiHydrationPromise;
    }

    app.deferredUiHydrationPromise = new Promise((resolve) => {
        scheduleTask(async () => {
            try {
                const {
                    ChartWorkspaceController,
                    ExerciseBoard,
                    ClassroomModeController,
                    ToolboxCategoryController,
                    TopActionMenuController,
                    FirstRunGuideController
                } = await import('./DeferredRuntimeControllersBundle.js');

                app.chartWorkspace = hydrateDeferredController(
                    app.chartWorkspace,
                    new ChartWorkspaceController(app)
                );
                if (app.responsiveLayout?.mode) {
                    app.chartWorkspace?.onLayoutModeChanged?.(app.responsiveLayout.mode);
                }
                app.exerciseBoard = hydrateDeferredController(app.exerciseBoard, new ExerciseBoard(app));
                app.topActionMenu = hydrateDeferredController(app.topActionMenu, new TopActionMenuController(app));
                app.toolboxCategoryController = hydrateDeferredController(
                    app.toolboxCategoryController,
                    new ToolboxCategoryController(app)
                );
                app.classroomMode = hydrateDeferredController(app.classroomMode, new ClassroomModeController(app));
                app.firstRunGuide = hydrateDeferredController(
                    app.firstRunGuide,
                    new FirstRunGuideController(app, {
                        enabled: !app.runtimeOptions?.enabled
                    })
                );
            } catch (error) {
                app.logger?.warn?.('Deferred UI hydration failed', error);
            }
            resolve(app);
        });
    });

    return app.deferredUiHydrationPromise;
}

export async function loadEmbedRuntimeBridgeClass() {
    const module = await import('../embed/EmbedRuntimeBridge.js');
    return module.EmbedRuntimeBridge;
}
