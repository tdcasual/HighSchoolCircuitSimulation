import { describe, expect, it, vi } from 'vitest';
import { CircuitSimulatorApp } from '../src/main.js';

describe('AI panel lazy load', () => {
    it('defers ai panel construction until first open action', async () => {
        const createdHosts = [];
        class FakeAIPanel {
            constructor(host) {
                createdHosts.push(host);
                this.collapsed = true;
            }

            setPanelCollapsed(next) {
                this.collapsed = !!next;
            }

            markPanelActive() {}
        }

        const app = Object.create(CircuitSimulatorApp.prototype);
        app.aiPanel = null;
        app.aiPanelLoadingPromise = null;
        app.aiPanelClassLoader = vi.fn(async () => FakeAIPanel);
        app.detachLazyAIPanelTriggers = vi.fn();

        expect(app.aiPanel).toBeNull();

        const panel = await app.openAIPanel();

        expect(panel).toBeTruthy();
        expect(app.aiPanel).toBeTruthy();
        expect(app.aiPanelClassLoader).toHaveBeenCalledTimes(1);
        expect(createdHosts).toEqual([app]);
        expect(app.detachLazyAIPanelTriggers).toHaveBeenCalledTimes(1);
    });
});
