function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
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

    toLinkedSnapshot(bounds = {}) {
        if (!this.readout) return null;
        const width = Math.max(1e-9, toFiniteNumber(bounds.width, 1));
        const height = Math.max(1e-9, toFiniteNumber(bounds.height, 1));
        return {
            xRatio: clamp01(this.readout.x / width),
            yRatio: clamp01(this.readout.y / height),
            frozen: this.isFrozen()
        };
    }

    resolvePointFromLinkedSnapshot(snapshot, bounds = {}) {
        if (!snapshot || typeof snapshot !== 'object') return null;
        const width = Math.max(1, toFiniteNumber(bounds.width, 1));
        const height = Math.max(1, toFiniteNumber(bounds.height, 1));
        const xRatio = clamp01(toFiniteNumber(snapshot.xRatio, 0));
        const yRatio = clamp01(toFiniteNumber(snapshot.yRatio, 0));
        return {
            x: xRatio * width,
            y: yRatio * height,
            frozen: !!snapshot.frozen
        };
    }
}
