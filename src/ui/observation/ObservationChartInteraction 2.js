function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export class ObservationChartInteraction {
    constructor({ holdMs = 350 } = {}) {
        this.holdMs = Math.max(0, toFiniteNumber(holdMs, 350));
        this.frozen = false;
        this.readout = null;
        this.pointerDown = null;
    }

    onPointerDown(event = {}) {
        const point = {
            x: toFiniteNumber(event.x, 0),
            y: toFiniteNumber(event.y, 0)
        };
        const time = toFiniteNumber(event.time, 0);
        const pointerType = String(event.pointerType || '').trim().toLowerCase() || 'mouse';

        if (this.frozen) {
            this.frozen = false;
            this.pointerDown = null;
            this.readout = null;
            return;
        }

        this.pointerDown = { ...point, time, pointerType };
        this.readout = point;
    }

    onPointerMove(event = {}) {
        const point = {
            x: toFiniteNumber(event.x, 0),
            y: toFiniteNumber(event.y, 0)
        };
        const time = toFiniteNumber(event.time, 0);
        this.readout = point;

        if (!this.pointerDown || this.frozen) return;
        const elapsed = time - this.pointerDown.time;
        const supportsHoldFreeze = this.pointerDown.pointerType !== 'mouse';
        if (supportsHoldFreeze && elapsed >= this.holdMs) {
            this.frozen = true;
            this.pointerDown = null;
        }
    }

    onPointerUp() {
        if (!this.frozen) {
            this.pointerDown = null;
        }
    }

    onPointerLeave() {
        this.pointerDown = null;
        if (!this.frozen) {
            this.readout = null;
        }
    }

    isFrozen() {
        return this.frozen;
    }

    getReadout() {
        return this.readout ? { ...this.readout } : null;
    }
}
