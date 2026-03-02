function resolveDocument(options = {}) {
    if (options.document && typeof options.document.getElementById === 'function') {
        return options.document;
    }
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
        return document;
    }
    return null;
}

function getNodeById(id, options = {}) {
    const doc = resolveDocument(options);
    if (!doc) return null;
    return doc.getElementById(id);
}

function setDisabled(node, disabled) {
    if (!node || typeof node !== 'object' || !('disabled' in node)) return;
    node.disabled = !!disabled;
}

function safeAddClass(node, className) {
    if (!node || !node.classList || typeof node.classList.add !== 'function') return;
    try {
        node.classList.add(className);
    } catch (_) {}
}

function safeRemoveClass(node, className) {
    if (!node || !node.classList || typeof node.classList.remove !== 'function') return;
    try {
        node.classList.remove(className);
    } catch (_) {}
}

export function setSimulationControlsRunning(isRunning, options = {}) {
    const running = !!isRunning;

    setDisabled(getNodeById('btn-run', options), running);
    setDisabled(getNodeById('btn-stop', options), !running);
    setDisabled(getNodeById('btn-mobile-run', options), running);
    setDisabled(getNodeById('btn-mobile-stop', options), !running);

    const mobileSimToggle = getNodeById('btn-mobile-sim-toggle', options);
    if (mobileSimToggle) {
        mobileSimToggle.textContent = running ? '停止' : '运行';
        mobileSimToggle.setAttribute?.('aria-pressed', running ? 'true' : 'false');
        if (running) {
            safeAddClass(mobileSimToggle, 'running');
        } else {
            safeRemoveClass(mobileSimToggle, 'running');
        }
    }

    const simulationStatus = getNodeById('simulation-status', options);
    if (simulationStatus) {
        simulationStatus.textContent = running ? '模拟: 运行中' : '模拟: 停止';
        if (running) {
            safeAddClass(simulationStatus, 'running');
        } else {
            safeRemoveClass(simulationStatus, 'running');
        }
    }
}

export function setStatusText(text, options = {}) {
    const statusNode = getNodeById('status-text', options);
    if (!statusNode) return;
    statusNode.textContent = text;
}
