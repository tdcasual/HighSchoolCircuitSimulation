export function debugRuntimeCircuit(app) {
    const logger = app.logger.child('debugCircuit');
    app.circuit.solver.debugMode = true;

    logger.info('=== Circuit Debug Info ===');
    logger.info('Components:', app.circuit.components.size);
    logger.info('Wires:', app.circuit.wires.size);
    logger.info('Nodes:', app.circuit.nodes.length);

    logger.info('\n--- Components ---');
    for (const [id, comp] of app.circuit.components) {
        logger.info(`${id} (${comp.type}): nodes=[${comp.nodes}], V=${comp.voltageValue?.toFixed(3)}, I=${comp.currentValue?.toFixed(3)}, R=${comp.resistance || comp.maxResistance || 'N/A'}`);
    }

    logger.info('\n--- Wires ---');
    for (const [id, wire] of app.circuit.wires) {
        const fmtEnd = (which) => {
            const ref = which === 'a' ? wire.aRef : wire.bRef;
            if (ref && ref.componentId !== undefined && ref.componentId !== null) {
                return `${ref.componentId}:${ref.terminalIndex}`;
            }
            const pt = which === 'a' ? wire.a : wire.b;
            if (pt && Number.isFinite(Number(pt.x)) && Number.isFinite(Number(pt.y))) {
                return `(${Math.round(Number(pt.x))},${Math.round(Number(pt.y))})`;
            }
            return '?';
        };
        logger.info(`${id}: ${fmtEnd('a')} -> ${fmtEnd('b')}`);
    }

    logger.info('\n--- Node Connections ---');
    const nodeConnections = {};
    for (const [id, comp] of app.circuit.components) {
        comp.nodes.forEach((node, termIdx) => {
            if (!nodeConnections[node]) nodeConnections[node] = [];
            nodeConnections[node].push(`${id}:${termIdx}`);
        });
    }
    for (const [node, terminals] of Object.entries(nodeConnections)) {
        logger.info(`Node ${node}: ${terminals.join(', ')}`);
    }

    logger.info('\n--- Running Solve ---');
    app.circuit.rebuildNodes();

    logger.info('\n--- After rebuildNodes ---');
    logger.info('Total nodes:', app.circuit.nodes.length);
    for (const [id, comp] of app.circuit.components) {
        logger.info(`  ${id}: nodes = [${comp.nodes}]`);
    }

    app.circuit.solver.setCircuit(
        Array.from(app.circuit.components.values()),
        app.circuit.nodes
    );

    logger.info('VoltageSourceCount:', app.circuit.solver.voltageSourceCount);

    const results = app.circuit.solver.solve(app.circuit.dt);

    logger.info('\n--- Solve Results ---');
    logger.info('Valid:', results.valid);
    logger.info('Voltages:', results.voltages);
    if (results.currents instanceof Map) {
        logger.info('Currents:', Object.fromEntries(results.currents));
    } else {
        logger.info('Currents:', results.currents);
    }

    app.circuit.solver.debugMode = false;
    return { circuit: app.circuit, results };
}

export function bindLazyAIPanelTriggers(app) {
    if (typeof document === 'undefined') return;
    const triggerIds = ['ai-fab-btn', 'ai-toggle-btn'];
    app.boundLazyAIOpen = (event) => {
        if (app.aiPanel) return;
        event?.preventDefault?.();
        event?.stopPropagation?.();
        void openAIPanel(app);
    };

    app.aiLazyTriggerElements = [];
    for (const id of triggerIds) {
        const element = document.getElementById(id);
        if (!element || typeof element.addEventListener !== 'function') continue;
        element.addEventListener('click', app.boundLazyAIOpen);
        app.aiLazyTriggerElements.push(element);
    }
}

export function detachLazyAIPanelTriggers(app) {
    if (!Array.isArray(app.aiLazyTriggerElements) || !app.boundLazyAIOpen) return;
    for (const element of app.aiLazyTriggerElements) {
        if (!element || typeof element.removeEventListener !== 'function') continue;
        element.removeEventListener('click', app.boundLazyAIOpen);
    }
    app.aiLazyTriggerElements = [];
}

export async function ensureAIPanelLoaded(app) {
    if (app.aiPanel) return app.aiPanel;
    if (app.aiPanelLoadingPromise) return app.aiPanelLoadingPromise;

    app.aiPanelLoadingPromise = (async () => {
        const AIPanelClass = await app.aiPanelClassLoader();
        app.aiPanel = new AIPanelClass(app);
        if (typeof app.detachLazyAIPanelTriggers === 'function') {
            app.detachLazyAIPanelTriggers();
        } else {
            detachLazyAIPanelTriggers(app);
        }
        return app.aiPanel;
    })();

    try {
        return await app.aiPanelLoadingPromise;
    } finally {
        app.aiPanelLoadingPromise = null;
    }
}

export async function openAIPanel(app) {
    const panel = await ensureAIPanelLoaded(app);
    panel?.setPanelCollapsed?.(false);
    panel?.markPanelActive?.();
    return panel;
}
