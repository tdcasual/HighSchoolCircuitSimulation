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

    readBufferPoint(buffer, index) {
        if (!buffer || typeof buffer.getPoint !== 'function') return null;
        const point = buffer.getPoint(index);
        if (!point) return null;
        const x = Number(point.x);
        const y = Number(point.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
    }

    findNearestSampleByX(buffer, targetX, options = {}) {
        if (!buffer || buffer.length <= 0 || !Number.isFinite(targetX)) {
            return {
                point: null,
                stats: { strategy: 'none', samplesVisited: 0 }
            };
        }

        const monotonicResult = this.findNearestSampleByXMonotonic(buffer, targetX, options);
        if (monotonicResult?.point) {
            return monotonicResult;
        }
        return this.findNearestSampleByXSampled(buffer, targetX, options);
    }

    findNearestSampleByXMonotonic(buffer, targetX, options = {}) {
        const totalLength = Number(buffer?.length) || 0;
        if (totalLength <= 0 || typeof buffer.getPoint !== 'function') {
            return null;
        }

        let samplesVisited = 0;
        const readAt = (index) => {
            const point = this.readBufferPoint(buffer, index);
            if (point) samplesVisited += 1;
            return point;
        };

        const first = readAt(0);
        const last = readAt(totalLength - 1);
        if (!first || !last || first.x === last.x) {
            return null;
        }

        const ascending = last.x > first.x;
        const checkpoints = [
            Math.floor(totalLength / 4),
            Math.floor(totalLength / 2),
            Math.floor((totalLength * 3) / 4)
        ];

        let previousX = first.x;
        for (const checkpoint of checkpoints) {
            if (checkpoint <= 0 || checkpoint >= totalLength - 1) continue;
            const point = readAt(checkpoint);
            if (!point) return null;
            if (ascending && point.x < previousX) return null;
            if (!ascending && point.x > previousX) return null;
            previousX = point.x;
        }

        let low = 0;
        let high = totalLength - 1;
        while (high - low > 1) {
            const mid = Math.floor((low + high) / 2);
            const midPoint = readAt(mid);
            if (!midPoint) break;
            const takeUpper = ascending ? midPoint.x < targetX : midPoint.x > targetX;
            if (takeUpper) {
                low = mid;
            } else {
                high = mid;
            }
        }

        const neighborRadius = Math.max(2, Math.floor(Number(options.localNeighborRadius) || 8));
        const from = Math.max(0, Math.min(low, high) - neighborRadius);
        const to = Math.min(totalLength - 1, Math.max(low, high) + neighborRadius);
        let best = null;
        let bestDistance = Infinity;
        for (let index = from; index <= to; index++) {
            const point = readAt(index);
            if (!point) continue;
            const distance = Math.abs(point.x - targetX);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = point;
            }
        }

        return {
            point: best,
            stats: {
                strategy: 'monotonic-binary',
                samplesVisited
            }
        };
    }

    findNearestSampleByXSampled(buffer, targetX, options = {}) {
        const totalLength = Number(buffer?.length) || 0;
        let best = null;
        let bestIndex = -1;
        let bestDistance = Infinity;
        let samplesVisited = 0;
        const coarseSampleLimit = Math.max(32, Math.floor(Number(options.coarseSampleLimit) || 512));
        const stride = totalLength > coarseSampleLimit
            ? Math.ceil(totalLength / coarseSampleLimit)
            : 1;

        const onCandidate = (x, y, index) => {
            samplesVisited += 1;
            const distance = Math.abs(x - targetX);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = { x, y };
                bestIndex = Number.isFinite(index) ? Math.floor(index) : bestIndex;
            }
        };

        if (typeof buffer.forEachSampled === 'function') {
            buffer.forEachSampled(stride, onCandidate);
        } else if (typeof buffer.forEach === 'function') {
            let cursor = 0;
            buffer.forEach((x, y) => {
                if (cursor % stride === 0) {
                    onCandidate(x, y, cursor);
                }
                cursor += 1;
            });
        }

        if (stride > 1 && bestIndex >= 0 && typeof buffer.getPoint === 'function') {
            const from = Math.max(0, bestIndex - stride);
            const to = Math.min(totalLength - 1, bestIndex + stride);
            for (let index = from; index <= to; index++) {
                const point = this.readBufferPoint(buffer, index);
                if (!point) continue;
                samplesVisited += 1;
                const distance = Math.abs(point.x - targetX);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = point;
                }
            }
        }

        return {
            point: best,
            stats: {
                strategy: stride > 1 ? 'sampled-refine' : 'full-scan',
                samplesVisited
            }
        };
    }
}
