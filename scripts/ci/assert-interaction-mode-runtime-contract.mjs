#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message) {
    console.error(`[interaction-mode-contract] ${message}`);
    process.exit(1);
}

function readText(relPath) {
    const absPath = path.resolve(root, relPath);
    if (!existsSync(absPath)) {
        fail(`missing file: ${relPath}`);
    }
    return readFileSync(absPath, 'utf8');
}

function assertPatternsAbsent({ source, patterns, relPath, message }) {
    for (const pattern of patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(source)) {
            fail(`${message} found in ${relPath}`);
        }
    }
}

const bridgePath = 'src/app/interaction/InteractionModeBridge.js';
const bridgeSource = readText(bridgePath);

const legacyBridgeReadPatterns = [
    /context\?\.(pendingToolType|mobileInteractionMode|stickyWireTool|isWiring|pendingTool|mobileMode|wireModeSticky|wiringActive|isDraggingWireEndpoint|isTerminalExtending|isRheostatDragging)/g
];

assertPatternsAbsent({
    source: bridgeSource,
    patterns: legacyBridgeReadPatterns,
    relPath: bridgePath,
    message: 'legacy runtime mode-field fallback read'
});

if (!bridgeSource.includes('return normalizeModeContextSnapshot();')) {
    fail(`store-miss fallback must use canonical empty mode snapshot in ${bridgePath}`);
}

const modeStateMachinePath = 'src/app/interaction/InteractionModeStateMachine.js';
const modeStateMachineSource = readText(modeStateMachinePath);
const legacyRuntimeSeedPatterns = [
    /pendingTool:\s*context\.(pendingToolType|pendingTool)/g,
    /mobileMode:\s*context\.(mobileInteractionMode|mobileMode)\s*===\s*'wire'/g,
    /wireModeSticky:\s*!!context\.(stickyWireTool|wireModeSticky)/g,
    /wiringActive:\s*!!context\.(isWiring|wiringActive)/g
];

assertPatternsAbsent({
    source: modeStateMachineSource,
    patterns: legacyRuntimeSeedPatterns,
    relPath: modeStateMachinePath,
    message: 'legacy runtime mode-field seed'
});

const stateInitializerPath = 'src/ui/interaction/InteractionStateInitializer.js';
const stateInitializerSource = readText(stateInitializerPath);
const legacyRuntimeInitPatterns = [
    /context\.(pendingToolType|mobileInteractionMode|stickyWireTool|isWiring)\s*=/g
];

assertPatternsAbsent({
    source: stateInitializerSource,
    patterns: legacyRuntimeInitPatterns,
    relPath: stateInitializerPath,
    message: 'legacy runtime mode-field initializer assignment'
});

const pointerSessionPath = 'src/ui/interaction/PointerSessionManager.js';
const pointerSessionSource = readText(pointerSessionPath);

const legacyPointerFallbackPatterns = [
    /\?\?\s*context\.(pendingToolType|mobileInteractionMode|stickyWireTool|pendingTool|mobileMode|wireModeSticky)/g,
    /\|\|\s*context\.(mobileInteractionMode|mobileMode)/g
];

assertPatternsAbsent({
    source: pointerSessionSource,
    patterns: legacyPointerFallbackPatterns,
    relPath: pointerSessionPath,
    message: 'legacy mode-field fallback read'
});

const storeOnlyRuntimeReadGuards = [
    {
        relPath: 'src/ui/interaction/ToolPlacementController.js',
        patterns: [
            /\bthis\.(pendingToolType|mobileInteractionMode|stickyWireTool|isWiring|pendingTool|mobileMode|wireModeSticky|wiringActive)\b/g
        ]
    },
    {
        relPath: 'src/ui/interaction/TouchActionController.js',
        patterns: [
            /\bthis\.interaction\??\.(pendingToolType|mobileInteractionMode|stickyWireTool|isWiring|pendingTool|mobileMode|wireModeSticky|wiringActive)\b/g
        ]
    },
    {
        relPath: 'src/app/interaction/InteractionOrchestratorMouseDownPendingToolHandlers.js',
        patterns: [
            /\bthis\.(pendingToolType|isWiring|pendingTool|wiringActive)\b/g
        ]
    },
    {
        relPath: 'src/app/interaction/InteractionOrchestrator.js',
        patterns: [
            /\bthis\.(isWiring|wiringActive)\b/g
        ]
    }
];

for (const guard of storeOnlyRuntimeReadGuards) {
    const source = readText(guard.relPath);
    assertPatternsAbsent({
        source,
        patterns: guard.patterns,
        relPath: guard.relPath,
        message: 'legacy mode-field direct read'
    });
}

console.log('[interaction-mode-contract] ok');
