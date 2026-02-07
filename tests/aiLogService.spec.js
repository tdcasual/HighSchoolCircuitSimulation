import { afterEach, describe, expect, it, vi } from 'vitest';
import { AILogService } from '../src/ai/AILogService.js';

function createStorageMock() {
    const store = new Map();
    return {
        getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
        setItem: vi.fn((key, value) => store.set(key, value)),
        removeItem: vi.fn((key) => store.delete(key))
    };
}

describe('AILogService', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('records events and computes summary', () => {
        const localStorageMock = createStorageMock();
        vi.stubGlobal('localStorage', localStorageMock);

        const service = new AILogService({ maxEntries: 10 });
        service.log({ level: 'info', source: 'ai_panel', stage: 'start', message: 'started' });
        service.log({ level: 'warn', source: 'ai_agent', stage: 'fallback', message: 'fallback used' });
        service.log({ level: 'error', source: 'openai_client', stage: 'call_failed', message: 'timeout' });

        const summary = service.getSummary();
        expect(summary.total).toBe(3);
        expect(summary.warnCount).toBe(1);
        expect(summary.errorCount).toBe(1);
        expect(summary.lastError?.source).toBe('openai_client');
        expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('creates and finishes traces with trace id', () => {
        const localStorageMock = createStorageMock();
        vi.stubGlobal('localStorage', localStorageMock);
        const service = new AILogService({ maxEntries: 10 });

        const traceId = service.createTrace('chat_question', { questionPreview: '分析电路' });
        service.log({ traceId, source: 'ai_agent', stage: 'model_call_start', message: 'start' });
        service.finishTrace(traceId, 'error', { error: 'signal is aborted without reason' });

        const entries = service.getEntries(10);
        const traceEntries = entries.filter(item => item.traceId === traceId);
        expect(traceEntries.length).toBeGreaterThanOrEqual(3);
        expect(traceEntries.some(item => item.stage === 'finish' && item.level === 'error')).toBe(true);
    });

    it('exports payload and clears logs', () => {
        const localStorageMock = createStorageMock();
        vi.stubGlobal('localStorage', localStorageMock);
        const service = new AILogService({ maxEntries: 10 });
        service.log({ source: 'ai_panel', stage: 'question_received', message: 'hello' });
        const payload = service.exportPayload(100);
        expect(payload.version).toBe(1);
        expect(Array.isArray(payload.entries)).toBe(true);
        expect(payload.entries.length).toBe(1);

        service.clear();
        expect(service.getEntries(10)).toHaveLength(0);
    });
});
