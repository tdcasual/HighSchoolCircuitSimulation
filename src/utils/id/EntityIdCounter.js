let entityIdCounter = 0;

export function generateEntityId(type) {
    return `${type}_${++entityIdCounter}`;
}

export function resetEntityIdCounter() {
    entityIdCounter = 0;
}

export function updateEntityIdCounterFromExisting(existingIds) {
    let maxNum = 0;
    for (const id of existingIds || []) {
        const match = String(id || '').match(/_(\d+)$/);
        if (!match) continue;
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
            maxNum = num;
        }
    }
    entityIdCounter = maxNum;
}
