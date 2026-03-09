const EMBED_MODE_EDIT = 'edit';
const EMBED_MODE_CLASSROOM = 'classroom';
const EMBED_MODE_READONLY = 'readonly';
const EMBED_MODES = Object.freeze([
    EMBED_MODE_EDIT,
    EMBED_MODE_CLASSROOM,
    EMBED_MODE_READONLY
]);

const CLASSROOM_LEVEL_OFF = 'off';
const CLASSROOM_LEVEL_STANDARD = 'standard';
const CLASSROOM_LEVEL_ENHANCED = 'enhanced';

function parseBooleanFlag(rawValue, fallbackValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
        return fallbackValue;
    }
    const normalized = String(rawValue).trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
        return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
        return false;
    }
    return fallbackValue;
}

export function createBridgeError(code, message, details = null) {
    const error = new Error(message);
    error.code = code;
    if (details !== null && details !== undefined) {
        error.details = details;
    }
    return error;
}

export function normalizeMode(rawMode) {
    const text = String(rawMode || '').trim().toLowerCase();
    return EMBED_MODES.includes(text) ? text : EMBED_MODE_EDIT;
}

export function normalizeClassroomLevel(rawLevel, mode = EMBED_MODE_EDIT) {
    const text = String(rawLevel || '').trim().toLowerCase();
    if (text === CLASSROOM_LEVEL_STANDARD || text === CLASSROOM_LEVEL_ENHANCED || text === CLASSROOM_LEVEL_OFF) {
        return text;
    }
    if (mode === EMBED_MODE_CLASSROOM) {
        return CLASSROOM_LEVEL_STANDARD;
    }
    return CLASSROOM_LEVEL_OFF;
}

function getDefaultFeatureFlags(mode) {
    if (mode === EMBED_MODE_READONLY) {
        return {
            toolbox: false,
            sidePanel: false,
            ai: false,
            exerciseBoard: false,
            statusBar: true
        };
    }
    if (mode === EMBED_MODE_CLASSROOM) {
        return {
            toolbox: true,
            sidePanel: true,
            ai: false,
            exerciseBoard: false,
            statusBar: true
        };
    }
    return {
        toolbox: true,
        sidePanel: true,
        ai: true,
        exerciseBoard: true,
        statusBar: true
    };
}

export function normalizeFeatureFlags(mode, incomingFlags = {}) {
    const defaults = getDefaultFeatureFlags(mode);
    const normalized = { ...defaults };
    for (const key of Object.keys(defaults)) {
        if (incomingFlags[key] === undefined) continue;
        normalized[key] = !!incomingFlags[key];
    }
    return normalized;
}

export function normalizeModeV2Strict(rawMode) {
    const text = String(rawMode || '').trim().toLowerCase();
    if (!EMBED_MODES.includes(text)) {
        throw createBridgeError('INVALID_MODE', `Unsupported embed mode for v2 runtime: ${String(rawMode || '')}`);
    }
    return text;
}

export function parseEmbedRuntimeOptionsFromSearch(search = '') {
    const query = typeof search === 'string' ? search : '';
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    const hasEmbedFlag = parseBooleanFlag(params.get('embed'), false);
    const hasModeFlag = params.has('mode');
    const enabled = hasEmbedFlag || hasModeFlag;
    const mode = normalizeMode(params.get('mode'));

    const rawFeatureFlags = {};
    [
        ['toolbox', 'toolbox'],
        ['sidePanel', 'sidePanel'],
        ['ai', 'ai'],
        ['exerciseBoard', 'exerciseBoard'],
        ['statusBar', 'statusBar']
    ].forEach(([queryKey, featureKey]) => {
        if (!params.has(queryKey)) return;
        rawFeatureFlags[featureKey] = parseBooleanFlag(params.get(queryKey), undefined);
    });

    const targetOrigin = params.get('targetOrigin') || '*';
    const allowedParentOrigins = (params.get('allowedOrigins') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (allowedParentOrigins.length === 0 && targetOrigin !== '*') {
        allowedParentOrigins.push(targetOrigin);
    }

    return {
        enabled,
        mode,
        readOnly: mode === EMBED_MODE_READONLY || parseBooleanFlag(params.get('readonly'), false),
        classroomLevel: normalizeClassroomLevel(params.get('classroomLevel'), mode),
        targetOrigin,
        allowedParentOrigins,
        autoSave: enabled ? parseBooleanFlag(params.get('autosave'), false) : true,
        restoreFromStorage: enabled ? parseBooleanFlag(params.get('restore'), false) : true,
        features: normalizeFeatureFlags(mode, rawFeatureFlags)
    };
}

export {
    CLASSROOM_LEVEL_ENHANCED,
    CLASSROOM_LEVEL_OFF,
    CLASSROOM_LEVEL_STANDARD,
    EMBED_MODE_CLASSROOM,
    EMBED_MODE_EDIT,
    EMBED_MODE_READONLY
};
