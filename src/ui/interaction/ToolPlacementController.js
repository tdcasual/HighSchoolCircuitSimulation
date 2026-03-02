import { ComponentNames } from '../../components/Component.js';
import { GRID_SIZE, snapToGrid } from '../../utils/CanvasCoords.js';

const ENDPOINT_AUTO_BRIDGE_STORAGE_KEY = 'interaction.endpoint_auto_bridge_mode';
const ENDPOINT_AUTO_BRIDGE_CLASSROOM_LOCK_LABEL = '端点补线: 课堂锁定';
const ENDPOINT_AUTO_BRIDGE_CLASSROOM_LOCK_NOTE = '课堂模式已锁定端点补线为关闭';

function normalizeMobileInteractionMode(mode) {
    return mode === 'wire' ? 'wire' : 'select';
}

function normalizeEndpointAutoBridgeMode(mode) {
    return mode === 'on' || mode === 'off' || mode === 'auto'
        ? mode
        : 'auto';
}

function isClassroomModeActive(context) {
    const level = String(context?.app?.classroomMode?.activeLevel || '').trim().toLowerCase();
    return level !== '' && level !== 'off';
}

function isEmbedRuntimeActive(context) {
    return !!context?.app?.embedRuntimeBridge?.enabled;
}

function hasDocument() {
    return typeof document !== 'undefined';
}

function safeClassListContains(classList, className) {
    const contains = classList?.contains;
    if (typeof contains !== 'function') return false;
    try {
        return !!contains.call(classList, className);
    } catch (_) {
        return false;
    }
}

function isPhoneLikeLayout() {
    if (!hasDocument()) return false;
    const bodyClassList = document.body?.classList;
    if (!bodyClassList) return false;
    return safeClassListContains(bodyClassList, 'layout-mode-phone')
        || safeClassListContains(bodyClassList, 'layout-mode-compact');
}

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

function clearSuspendedWiringSession(context) {
    if (!context) return;
    context.suspendedWiringSession = null;
}

function syncInteractionModeStore(context, options = {}) {
    const sync = context?.syncInteractionModeStore;
    if (typeof sync !== 'function') return null;
    try {
        return sync.call(context, options);
    } catch (_) {
        return null;
    }
}

function resolveStorage() {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
}

function loadEndpointAutoBridgeModeFromStorage() {
    const storage = resolveStorage();
    if (!storage) return null;
    try {
        return normalizeEndpointAutoBridgeMode(storage.getItem(ENDPOINT_AUTO_BRIDGE_STORAGE_KEY));
    } catch (_) {
        return null;
    }
}

function saveEndpointAutoBridgeModeToStorage(mode) {
    const storage = resolveStorage();
    if (!storage) return false;
    try {
        storage.setItem(ENDPOINT_AUTO_BRIDGE_STORAGE_KEY, normalizeEndpointAutoBridgeMode(mode));
        return true;
    } catch (_) {
        return false;
    }
}

function getEndpointAutoBridgeButtonLabel(mode) {
    if (mode === 'on') return '端点补线: 总是开启';
    if (mode === 'off') return '端点补线: 已关闭';
    return '端点补线: 手机自动';
}

function setTogglePressedState(button, pressed) {
    if (!button) return;
    safeInvokeMethod(button, 'setAttribute', 'aria-pressed', pressed ? 'true' : 'false');
    safeInvokeMethod(button?.classList, 'toggle', 'active', !!pressed);
}

export function syncMobileModeButtons() {
    if (!hasDocument()) return;
    const mode = normalizeMobileInteractionMode(this.mobileInteractionMode);
    const selectButton = document.getElementById('btn-mobile-mode-select');
    const wireButton = document.getElementById('btn-mobile-mode-wire');
    setTogglePressedState(selectButton, mode !== 'wire');
    setTogglePressedState(wireButton, mode === 'wire');
    syncEndpointAutoBridgeButton.call(this);
}

export function syncEndpointAutoBridgeButton() {
    if (!hasDocument()) return;
    const button = document.getElementById('btn-mobile-endpoint-bridge-mode');
    const note = document.getElementById('mobile-endpoint-bridge-note');
    if (!button) return;
    const mode = normalizeEndpointAutoBridgeMode(this.endpointAutoBridgeMode);
    const classroomActive = isClassroomModeActive(this);
    button.textContent = classroomActive
        ? ENDPOINT_AUTO_BRIDGE_CLASSROOM_LOCK_LABEL
        : getEndpointAutoBridgeButtonLabel(mode);
    button.dataset.mode = mode;
    button.disabled = classroomActive;
    button.title = classroomActive
        ? '课堂模式下端点补线已锁定关闭'
        : '切换端点自动补线模式';
    if (note) {
        note.hidden = !classroomActive;
        note.textContent = ENDPOINT_AUTO_BRIDGE_CLASSROOM_LOCK_NOTE;
    }
}

export function getInteractionModeSnapshot() {
    const mobileInteractionMode = normalizeMobileInteractionMode(this.mobileInteractionMode);
    const endpointAutoBridgeMode = normalizeEndpointAutoBridgeMode(this.endpointAutoBridgeMode);

    const wireSignals = {
        pendingWireTool: this.pendingToolType === 'Wire',
        wireModeSelected: mobileInteractionMode === 'wire',
        stickyWireTool: !!this.stickyWireTool,
        activeWiringSession: !!this.isWiring
    };
    const endpointSignals = {
        draggingWireEndpoint: !!this.isDraggingWireEndpoint,
        terminalExtending: !!this.isTerminalExtending,
        rheostatDragging: !!this.isRheostatDragging
    };

    const activeModes = [];
    if (
        wireSignals.pendingWireTool
        || wireSignals.wireModeSelected
        || wireSignals.stickyWireTool
        || wireSignals.activeWiringSession
    ) {
        activeModes.push('wire');
    }
    if (
        endpointSignals.draggingWireEndpoint
        || endpointSignals.terminalExtending
        || endpointSignals.rheostatDragging
    ) {
        activeModes.push('endpoint-edit');
    }
    if (activeModes.length === 0) {
        activeModes.push('select');
    }

    const uniqueActiveModes = Array.from(new Set(activeModes));
    const hasConflict = uniqueActiveModes.length > 1;

    return {
        mode: hasConflict ? 'conflict' : uniqueActiveModes[0],
        activeModes: uniqueActiveModes,
        hasConflict,
        pendingToolType: this.pendingToolType || null,
        wireSignals,
        endpointSignals,
        mobile: {
            interactionMode: mobileInteractionMode,
            stickyWireTool: !!this.stickyWireTool,
            endpointAutoBridgeMode
        },
        runtime: {
            phoneLikeLayout: isPhoneLikeLayout(),
            classroomModeActive: isClassroomModeActive(this),
            embedRuntimeActive: isEmbedRuntimeActive(this)
        }
    };
}

export function setEndpointAutoBridgeMode(mode = 'auto', options = {}) {
    const classroomActive = isClassroomModeActive(this);
    const requestedMode = normalizeEndpointAutoBridgeMode(mode);
    const blockedByClassroomLock = classroomActive && requestedMode !== 'off';
    const normalizedMode = blockedByClassroomLock ? 'off' : requestedMode;
    this.endpointAutoBridgeMode = normalizedMode;

    const shouldPersist = options.persist !== false && !blockedByClassroomLock;
    if (shouldPersist) {
        saveEndpointAutoBridgeModeToStorage(normalizedMode);
    }

    syncEndpointAutoBridgeButton.call(this);

    if (!options.silentStatus && typeof this.updateStatus === 'function') {
        if (blockedByClassroomLock) {
            this.updateStatus('课堂模式下端点补线已锁定关闭');
        } else {
            this.updateStatus(getEndpointAutoBridgeButtonLabel(normalizedMode));
        }
    }

    return normalizedMode;
}

export function cycleEndpointAutoBridgeMode(options = {}) {
    const currentMode = normalizeEndpointAutoBridgeMode(this.endpointAutoBridgeMode);
    const nextMode = currentMode === 'auto'
        ? 'on'
        : (currentMode === 'on' ? 'off' : 'auto');
    return setEndpointAutoBridgeMode.call(this, nextMode, options);
}

export function restoreEndpointAutoBridgeMode(options = {}) {
    const storedMode = loadEndpointAutoBridgeModeFromStorage();
    const nextMode = storedMode || normalizeEndpointAutoBridgeMode(this.endpointAutoBridgeMode);
    return setEndpointAutoBridgeMode.call(this, nextMode, {
        persist: false,
        silentStatus: options.silentStatus !== false
    });
}

export function setMobileInteractionMode(mode = 'select', options = {}) {
    clearSuspendedWiringSession(this);
    const nextMode = normalizeMobileInteractionMode(mode);
    const isWireMode = nextMode === 'wire';

    this.mobileInteractionMode = nextMode;
    this.stickyWireTool = isWireMode;

    if (isWireMode) {
        this.setPendingToolType('Wire', null, {
            allowToggleOff: false,
            silentStatus: true,
            source: 'mobile-mode'
        });
        if (!options.silentStatus) {
            this.updateStatus('已切换到布线模式');
        }
    } else {
        if (this.isWiring && typeof this.cancelWiring === 'function') {
            this.cancelWiring();
        }
        if (this.pendingToolType === 'Wire' && typeof this.clearPendingToolType === 'function') {
            this.clearPendingToolType({ silent: true, preserveMobileMode: true });
        }
        if (!options.silentStatus) {
            this.updateStatus('已切换到选择模式');
        }
    }

    syncInteractionModeStore(this, {
        mode: isWireMode ? 'wire' : 'select',
        source: 'toolPlacement.setMobileInteractionMode',
        context: {
            pendingToolType: isWireMode ? 'Wire' : null,
            mobileInteractionMode: this.mobileInteractionMode,
            stickyWireTool: this.stickyWireTool,
            isWiring: !!this.isWiring
        }
    });

    this.syncMobileModeButtons?.();
    this.quickActionBar?.update?.();
}

export function setPendingToolType(type, item = null, options = {}) {
    clearSuspendedWiringSession(this);
    if (!type) return;
    const allowToggleOff = options.allowToggleOff !== false;
    if (this.pendingToolType === type) {
        if (!allowToggleOff) {
            this.syncMobileModeButtons?.();
            return;
        }
        if (type === 'Wire' && this.isWiring && typeof this.cancelWiring === 'function') {
            this.cancelWiring();
        }
        this.stickyWireTool = false;
        this.mobileInteractionMode = 'select';
        this.clearPendingToolType({ preserveMobileMode: true });
        if (!options.silentStatus) {
            this.updateStatus('已取消工具放置模式');
        }
        syncInteractionModeStore(this, {
            mode: 'select',
            source: 'toolPlacement.setPendingToolType:toggle-off',
            context: {
                pendingToolType: null,
                mobileInteractionMode: this.mobileInteractionMode,
                stickyWireTool: this.stickyWireTool,
                isWiring: !!this.isWiring
            }
        });
        this.syncMobileModeButtons?.();
        return;
    }

    this.pendingToolType = type;
    this.pendingToolItem = item;
    if (hasDocument()) {
        document.querySelectorAll('.tool-item.tool-item-pending').forEach((el) => safeRemoveClass(el, 'tool-item-pending'));
    }
    if (item) safeAddClass(item, 'tool-item-pending');

    if (type === 'Wire') {
        const fromMobileMode = options.source === 'mobile-mode';
        this.stickyWireTool = !!fromMobileMode;
        this.mobileInteractionMode = fromMobileMode ? 'wire' : normalizeMobileInteractionMode(this.mobileInteractionMode);
    } else {
        this.stickyWireTool = false;
        this.mobileInteractionMode = 'select';
    }

    const layout = this.app?.responsiveLayout;
    const shouldAutoCloseDrawers = !!layout?.isOverlayMode?.()
        && (layout.toolboxOpen || layout.sidePanelOpen);
    if (shouldAutoCloseDrawers) {
        layout.closeDrawers?.();
    }

    if (!options.silentStatus) {
        this.updateStatus(`已选择 ${ComponentNames[type] || type}，点击画布放置`);
    }
    syncInteractionModeStore(this, {
        mode: type === 'Wire' ? 'wire' : 'select',
        source: 'toolPlacement.setPendingToolType',
        context: {
            pendingToolType: this.pendingToolType,
            mobileInteractionMode: this.mobileInteractionMode,
            stickyWireTool: this.stickyWireTool,
            isWiring: !!this.isWiring
        }
    });
    this.syncMobileModeButtons?.();
}

export function clearPendingToolType(options = {}) {
    clearSuspendedWiringSession(this);
    this.pendingToolType = null;
    if (this.pendingToolItem) {
        safeRemoveClass(this.pendingToolItem, 'tool-item-pending');
        this.pendingToolItem = null;
    }
    if (!options.silent) {
        if (hasDocument()) {
            document.querySelectorAll('.tool-item.tool-item-pending').forEach((el) => safeRemoveClass(el, 'tool-item-pending'));
        }
    }
    if (!options.preserveMobileMode) {
        this.stickyWireTool = false;
        this.mobileInteractionMode = 'select';
    }
    syncInteractionModeStore(this, {
        source: 'toolPlacement.clearPendingToolType',
        context: {
            pendingToolType: this.pendingToolType,
            mobileInteractionMode: this.mobileInteractionMode,
            stickyWireTool: this.stickyWireTool,
            isWiring: !!this.isWiring
        }
    });
    this.syncMobileModeButtons?.();
}

export function placePendingToolAt(clientX, clientY) {
    if (!this.pendingToolType) return false;
    const canvas = this.screenToCanvas(clientX, clientY);
    const x = snapToGrid(canvas.x, GRID_SIZE);
    const y = snapToGrid(canvas.y, GRID_SIZE);
    if (this.pendingToolType === 'Wire') {
        this.addWireAt(x, y);
    } else {
        this.addComponent(this.pendingToolType, x, y);
    }
    this.clearPendingToolType({ silent: true });
    return true;
}
