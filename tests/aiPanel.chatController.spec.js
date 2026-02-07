import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatController } from '../src/ui/ai/ChatController.js';

describe('ChatController', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('stores dependency bag', () => {
        const deps = { panel: {}, app: {}, circuit: {} };
        const controller = new ChatController(deps);
        expect(controller.deps).toBe(deps);
    });

    it('runs askQuestion against panel context', async () => {
        const sendBtn = { textContent: '发送', disabled: false };
        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => (id === 'chat-send-btn' ? sendBtn : null))
        });

        const panel = {
            isProcessing: false,
            circuit: { components: new Map() },
            addChatMessage: vi.fn(),
            getAgentConversationContext: vi.fn().mockReturnValue([]),
            aiAgent: { answerQuestion: vi.fn() },
            removeChatMessage: vi.fn(),
            updateKnowledgeVersionDisplay: vi.fn(),
            lastQuestion: ''
        };
        const controller = new ChatController({ panel });

        await controller.askQuestion('  控制器测试  ');

        expect(panel.addChatMessage).toHaveBeenNthCalledWith(1, 'user', '控制器测试');
        expect(panel.addChatMessage).toHaveBeenNthCalledWith(2, 'system', '当前电路为空，请先添加元器件或上传电路图。');
        expect(panel.aiAgent.answerQuestion).not.toHaveBeenCalled();
    });
});
