import { afterEach, describe, expect, it, vi } from 'vitest';
import { ObservationPanel } from '../src/ui/ObservationPanel.js';

function createFakeElement(tagName = 'div') {
    return {
        tagName: String(tagName).toUpperCase(),
        id: '',
        className: '',
        textContent: '',
        style: {},
        attributes: {},
        children: [],
        addEventListener: vi.fn(),
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const idx = this.children.indexOf(child);
            if (idx >= 0) this.children.splice(idx, 1);
            return child;
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        get firstChild() {
            return this.children.length > 0 ? this.children[0] : null;
        }
    };
}

function findByAttr(root, attr, value) {
    if (!root) return null;
    if (root.attributes?.[attr] === value) return root;
    for (const child of root.children || []) {
        const found = findByAttr(child, attr, value);
        if (found) return found;
    }
    return null;
}

describe('ObservationPanel UX mode toolbar', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('renders mode toggles and quick preset entries', () => {
        const root = createFakeElement('div');
        const panelPage = createFakeElement('section');
        panelPage.className = 'active';

        vi.stubGlobal('document', {
            getElementById: vi.fn((id) => {
                if (id === 'observation-root') return root;
                if (id === 'panel-observation') return panelPage;
                return null;
            }),
            createElement: vi.fn((tag) => createFakeElement(tag))
        });
        vi.stubGlobal('window', {
            addEventListener: vi.fn(),
            requestAnimationFrame: vi.fn(() => 1),
            devicePixelRatio: 1
        });

        vi.spyOn(ObservationPanel.prototype, 'bindTabRefresh').mockImplementation(() => {});
        vi.spyOn(ObservationPanel.prototype, 'addPlot').mockImplementation(() => {});
        vi.spyOn(ObservationPanel.prototype, 'refreshDialGauges').mockImplementation(() => {});

        const app = { circuit: { components: new Map() } };
        const panel = new ObservationPanel(app);

        expect(panel).toBeTruthy();
        expect(findByAttr(root, 'data-observation-mode', 'basic')).toBeTruthy();
        expect(findByAttr(root, 'data-observation-mode', 'advanced')).toBeTruthy();
        const presetButton = findByAttr(root, 'data-observation-preset', 'voltage-time');
        expect(presetButton).toBeTruthy();
        expect(String(presetButton.attributes?.['aria-label'] || '')).toContain('快速添加电压-时间图');
        expect(findByAttr(root, 'data-observation-template-action', 'save')).toBeTruthy();
        expect(findByAttr(root, 'data-observation-template-action', 'apply')).toBeTruthy();
        expect(findByAttr(root, 'data-observation-template-select', 'true')).toBeTruthy();
    });
});
