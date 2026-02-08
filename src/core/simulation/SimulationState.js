export class SimulationState {
    constructor() {
        this.byId = new Map();
    }

    get(id) {
        return this.byId.get(id);
    }

    ensure(id) {
        if (!this.byId.has(id)) {
            this.byId.set(id, {});
        }
        return this.byId.get(id);
    }

    resetForComponents(components = []) {
        const list = Array.isArray(components) ? components : [];
        for (const comp of list) {
            if (!comp || !comp.id) continue;
            const entry = this.ensure(comp.id);
            this.resetEntryForComponent(entry, comp);
        }
    }

    resetEntryForComponent(entry, comp) {
        if (!entry || !comp) return;
        switch (comp.type) {
            case 'Capacitor':
            case 'ParallelPlateCapacitor':
                entry.prevVoltage = 0;
                entry.prevCharge = 0;
                entry.prevCurrent = 0;
                entry._dynamicHistoryReady = false;
                break;
            case 'Inductor':
                entry.prevCurrent = Number.isFinite(comp.initialCurrent) ? comp.initialCurrent : 0;
                entry.prevVoltage = 0;
                entry._dynamicHistoryReady = false;
                break;
            case 'Motor':
                entry.speed = 0;
                entry.backEmf = 0;
                break;
            case 'Diode':
            case 'LED':
                entry.conducting = false;
                break;
            case 'Relay':
                entry.energized = false;
                break;
            default:
                break;
        }
    }
}
