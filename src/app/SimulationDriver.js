export class SimulationDriver {
    constructor({
        circuit,
        intervalMs = 10,
        setIntervalFn = globalThis.setInterval.bind(globalThis),
        clearIntervalFn = globalThis.clearInterval.bind(globalThis)
    } = {}) {
        this.circuit = circuit;
        this.intervalMs = intervalMs;
        this._setInterval = setIntervalFn;
        this._clearInterval = clearIntervalFn;
        this._timer = null;
    }

    get isRunning() {
        return this._timer != null;
    }

    start() {
        if (this._timer != null) return;
        this.circuit.prepareSimulation();
        try {
            this._timer = this._setInterval(() => {
                this.circuit.step();
            }, this.intervalMs);
        } catch (error) {
            this._timer = null;
            this.circuit.haltSimulation();
            throw error;
        }
    }

    stop() {
        if (this._timer != null) this._clearInterval(this._timer);
        this._timer = null;
        this.circuit.haltSimulation();
    }
}
