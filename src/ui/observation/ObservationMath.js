/**
 * ObservationMath.js - 观察面板的纯计算工具
 * 包含变换、刻度与高性能采样缓存（无 DOM 依赖，便于单元测试）
 */

export const TransformIds = /** @type {const} */ ({
    Identity: 'identity',
    Abs: 'abs',
    Negate: 'negate',
    Reciprocal: 'reciprocal',
    ReciprocalAbs: 'reciprocalAbs'
});

export const TransformOptions = [
    { id: TransformIds.Identity, label: '原值' },
    { id: TransformIds.Abs, label: '绝对值 |x|' },
    { id: TransformIds.Negate, label: '取反 -x' },
    { id: TransformIds.Reciprocal, label: '倒数 1/x' },
    { id: TransformIds.ReciprocalAbs, label: '倒数 1/|x|' }
];

export function applyTransform(value, transformId) {
    if (!Number.isFinite(value)) return null;

    switch (transformId) {
        case TransformIds.Identity:
        default:
            return value;
        case TransformIds.Abs:
            return Math.abs(value);
        case TransformIds.Negate:
            return -value;
        case TransformIds.Reciprocal: {
            const eps = 1e-12;
            if (Math.abs(value) < eps) return null;
            const out = 1 / value;
            return Number.isFinite(out) ? out : null;
        }
        case TransformIds.ReciprocalAbs: {
            const eps = 1e-12;
            const abs = Math.abs(value);
            if (abs < eps) return null;
            const out = 1 / abs;
            return Number.isFinite(out) ? out : null;
        }
    }
}

export class RingBuffer2D {
    constructor(capacity) {
        const cap = Math.floor(capacity);
        if (!Number.isFinite(capacity) || cap <= 0) {
            throw new Error('RingBuffer2D capacity must be > 0');
        }
        this.capacity = cap;
        this.x = new Float64Array(cap);
        this.y = new Float64Array(cap);
        this._start = 0;
        this._length = 0;
        this._cachedRange = null;
        this._rangeDirty = false;
    }

    clear() {
        this._start = 0;
        this._length = 0;
        this._cachedRange = null;
        this._rangeDirty = false;
    }

    get length() {
        return this._length;
    }

    push(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        let overwrittenX = null;
        let overwrittenY = null;
        const writeIndex = (this._start + this._length) % this.capacity;
        if (this._length >= this.capacity) {
            overwrittenX = this.x[writeIndex];
            overwrittenY = this.y[writeIndex];
        }
        this.x[writeIndex] = x;
        this.y[writeIndex] = y;

        if (this._length < this.capacity) {
            this._length += 1;
        } else {
            this._start = (this._start + 1) % this.capacity;
            if (this._cachedRange && (
                overwrittenX === this._cachedRange.minX
                || overwrittenX === this._cachedRange.maxX
                || overwrittenY === this._cachedRange.minY
                || overwrittenY === this._cachedRange.maxY
            )) {
                this._rangeDirty = true;
            }
        }

        if (!this._cachedRange) {
            this._cachedRange = { minX: x, maxX: x, minY: y, maxY: y };
            this._rangeDirty = false;
            return;
        }

        this._cachedRange.minX = Math.min(this._cachedRange.minX, x);
        this._cachedRange.maxX = Math.max(this._cachedRange.maxX, x);
        this._cachedRange.minY = Math.min(this._cachedRange.minY, y);
        this._cachedRange.maxY = Math.max(this._cachedRange.maxY, y);
    }

    getPoint(index) {
        if (!Number.isFinite(index)) return null;
        const i = Math.floor(index);
        if (i < 0 || i >= this._length) return null;
        const idx = (this._start + i) % this.capacity;
        return { x: this.x[idx], y: this.y[idx] };
    }

    forEach(callback) {
        for (let i = 0; i < this._length; i++) {
            const idx = (this._start + i) % this.capacity;
            callback(this.x[idx], this.y[idx], i);
        }
    }

    forEachSampled(step, callback) {
        const stride = Math.max(1, Math.floor(Number(step) || 1));
        for (let i = 0; i < this._length; i += stride) {
            const idx = (this._start + i) % this.capacity;
            callback(this.x[idx], this.y[idx], i);
        }
    }

    getRange() {
        if (this._length <= 0) return null;
        if (this._cachedRange && !this._rangeDirty) {
            return { ...this._cachedRange };
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        this.forEach((x, y) => {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        });

        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
            this._cachedRange = null;
            this._rangeDirty = false;
            return null;
        }

        this._cachedRange = { minX, maxX, minY, maxY };
        this._rangeDirty = false;
        return { ...this._cachedRange };
    }
}

export function computeRangeFromBuffer(buffer) {
    if (!buffer || buffer.length <= 0) return null;
    if (typeof buffer.getRange === 'function') {
        return buffer.getRange();
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    buffer.forEach((x, y) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
        return null;
    }
    return { minX, maxX, minY, maxY };
}

function niceNumber(range, round) {
    if (!Number.isFinite(range) || range <= 0) return 0;
    const exponent = Math.floor(Math.log10(range));
    const fraction = range / Math.pow(10, exponent);
    let niceFraction;

    if (round) {
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 3) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;
    } else {
        if (fraction <= 1) niceFraction = 1;
        else if (fraction <= 2) niceFraction = 2;
        else if (fraction <= 5) niceFraction = 5;
        else niceFraction = 10;
    }

    return niceFraction * Math.pow(10, exponent);
}

export function computeNiceTicks(min, max, maxTicks = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
    if (maxTicks < 2) return [min, max].filter(Number.isFinite);

    let lo = min;
    let hi = max;
    if (lo === hi) {
        const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
        lo -= pad;
        hi += pad;
    }
    if (lo > hi) [lo, hi] = [hi, lo];

    const range = niceNumber(hi - lo, false);
    const step = niceNumber(range / (maxTicks - 1), true);
    if (step <= 0) return [];

    const niceMin = Math.floor(lo / step) * step;
    const niceMax = Math.ceil(hi / step) * step;

    const ticks = [];
    for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
        ticks.push(v);
    }
    return ticks;
}

export function formatNumberCompact(value, fractionDigits = 3) {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs === 0) return '0';
    if (abs >= 1e6 || abs < 1e-3) {
        return value.toExponential(2);
    }
    return value.toFixed(fractionDigits);
}
