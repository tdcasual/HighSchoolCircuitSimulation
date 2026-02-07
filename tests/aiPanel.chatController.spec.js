import { describe, expect, it } from 'vitest';
import { ChatController } from '../src/ui/ai/ChatController.js';

describe('ChatController', () => {
    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new ChatController(deps);
        expect(controller.deps).toBe(deps);
    });
});
