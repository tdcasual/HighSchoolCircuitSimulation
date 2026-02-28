import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatController, classifyChatMessageDensity } from '../src/ui/ai/ChatController.js';

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

    it('classifies short assistant messages as compact on phone', () => {
        const density = classifyChatMessageDensity({
            role: 'assistant',
            content: '这是一个简短回答。',
            isPhoneMode: true
        });
        expect(density).toBe('compact');
    });

    it('classifies long structured assistant messages as relaxed on phone', () => {
        const longStructured = [
            '第一步：先看电源与负载关系。',
            '第二步：再看分压与分流。',
            '- 列出已知条件',
            '- 建立等效电路',
            '- 对关键节点做电压电流分析',
            '```',
            'I = U / R',
            '```'
        ].join('\n');

        const density = classifyChatMessageDensity({
            role: 'assistant',
            content: longStructured.repeat(4),
            isPhoneMode: true
        });
        expect(density).toBe('relaxed');
    });

    it('keeps non-assistant messages as normal density', () => {
        const density = classifyChatMessageDensity({
            role: 'user',
            content: '我想问一个问题',
            isPhoneMode: true
        });
        expect(density).toBe('normal');
    });
});
