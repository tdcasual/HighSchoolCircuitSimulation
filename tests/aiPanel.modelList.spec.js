import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIPanel } from '../src/ui/AIPanel.js';

function createOptionElement() {
    return {
        value: '',
        textContent: ''
    };
}

function createOptionHost() {
    const host = {
        innerHTML: '',
        options: [],
        appendChild(node) {
            this.options.push(node);
            return node;
        }
    };
    return host;
}

describe('AIPanel model list filtering', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('keeps text model list options', () => {
        const textList = createOptionHost();
        const textSelect = createOptionHost();
        const textInput = { value: 'deepseek-chat' };

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => ({
                'model-list-text': textList,
                'text-model-select': textSelect,
                'text-model': textInput
            }[id] || null)),
            createElement: vi.fn((tag) => {
                if (tag !== 'option') throw new Error(`unexpected tag: ${tag}`);
                return createOptionElement();
            })
        });

        const ctx = {
            fillSelectOptions: AIPanel.prototype.fillSelectOptions,
            syncSelectToValue: AIPanel.prototype.syncSelectToValue
        };
        AIPanel.prototype.populateModelLists.call(ctx, [
            'deepseek-chat',
            'gpt-4o-mini',
            'gpt-4.1-mini',
            'text-only-model'
        ]);

        const textIds = textList.options.map((opt) => opt.value);
        expect(textIds).toEqual(['deepseek-chat', 'gpt-4o-mini', 'gpt-4.1-mini', 'text-only-model']);
    });
});
