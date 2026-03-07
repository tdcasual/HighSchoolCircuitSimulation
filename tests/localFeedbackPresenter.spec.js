import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalFeedbackPresenter } from '../src/ui/interaction/LocalFeedbackPresenter.js';

function createElementMock(tagName = 'div') {
    return {
        tagName: tagName.toUpperCase(),
        className: '',
        textContent: '',
        children: [],
        style: {},
        dataset: {},
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        setAttribute: vi.fn()
    };
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('LocalFeedbackPresenter', () => {
    it('renders local property-panel feedback into the target container', () => {
        const target = createElementMock('div');
        Object.defineProperty(target, 'innerHTML', {
            get() {
                return '';
            },
            set(value) {
                if (value === '') {
                    this.children = [];
                }
            }
        });
        vi.stubGlobal('document', {
            createElement: vi.fn((tag) => createElementMock(tag)),
            getElementById: vi.fn((id) => (id === 'property-content' ? target : null))
        });

        const presenter = new LocalFeedbackPresenter({});
        const shown = presenter.show('属性面板暂不可用', { scope: 'property-panel' });

        expect(shown).toBe(true);
        expect(target.children).toHaveLength(1);
        expect(target.children[0].textContent).toBe('属性面板暂不可用');
        expect(target.children[0].className).toContain('hint');
    });

    it('routes quick-action feedback to the quick-action hint presenter when available', () => {
        const showHint = vi.fn();
        const presenter = new LocalFeedbackPresenter({
            quickActionBar: {
                showHint
            }
        });

        const shown = presenter.show('请先选择一个元件', { scope: 'quick-action' });

        expect(shown).toBe(true);
        expect(showHint).toHaveBeenCalledWith('请先选择一个元件', 2200);
    });
});
