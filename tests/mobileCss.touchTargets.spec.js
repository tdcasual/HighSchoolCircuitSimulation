import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function readStyleSheet() {
    const cssPath = path.resolve(process.cwd(), 'css', 'style.css');
    return readFileSync(cssPath, 'utf8');
}

function extractRuleBlock(css, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const match = css.match(regex);
    return match ? match[1] : '';
}

function extractPxValue(block, property) {
    const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*:\\s*([0-9.]+)px`, 'm');
    const match = block.match(regex);
    if (!match) return Number.NaN;
    return Number(match[1]);
}

describe('mobile css touch targets', () => {
    it('keeps phone top more button touch height >= 40px', () => {
        const css = readStyleSheet();
        const block = extractRuleBlock(css, 'body.layout-mode-phone .top-action-btn-more');
        const minHeightPx = extractPxValue(block, 'min-height');

        expect(block.length).toBeGreaterThan(0);
        expect(Number.isFinite(minHeightPx)).toBe(true);
        expect(minHeightPx).toBeGreaterThanOrEqual(40);
    });

    it('keeps phone AI send button touch target >= 44px', () => {
        const css = readStyleSheet();
        const block = extractRuleBlock(css, 'body.layout-mode-phone #chat-send-btn');
        const minHeightPx = extractPxValue(block, 'min-height');
        const minWidthPx = extractPxValue(block, 'min-width');

        expect(block.length).toBeGreaterThan(0);
        expect(Number.isFinite(minHeightPx)).toBe(true);
        expect(Number.isFinite(minWidthPx)).toBe(true);
        expect(minHeightPx).toBeGreaterThanOrEqual(44);
        expect(minWidthPx).toBeGreaterThanOrEqual(44);
    });

    it('keeps phone AI insert buttons touch height >= 44px', () => {
        const css = readStyleSheet();
        const block = extractRuleBlock(css, 'body.layout-mode-phone .chat-insert-btn');
        const minHeightPx = extractPxValue(block, 'min-height');

        expect(block.length).toBeGreaterThan(0);
        expect(Number.isFinite(minHeightPx)).toBe(true);
        expect(minHeightPx).toBeGreaterThanOrEqual(44);
    });

    it('keeps phone AI panel action buttons touch height >= 44px', () => {
        const css = readStyleSheet();
        const block = extractRuleBlock(css, 'body.layout-mode-phone #ai-panel-actions button');
        const minHeightPx = extractPxValue(block, 'min-height');

        expect(block.length).toBeGreaterThan(0);
        expect(Number.isFinite(minHeightPx)).toBe(true);
        expect(minHeightPx).toBeGreaterThanOrEqual(44);
    });

    it('hides phone mobile controls while ai input is active to prevent mis-taps', () => {
        const css = readStyleSheet();
        expect(css.includes('body.layout-mode-phone.ai-input-active #canvas-mobile-controls')).toBe(true);
        expect(css.includes('body.layout-mode-phone.ai-keyboard-open #canvas-mobile-controls')).toBe(true);
        expect(css.includes('pointer-events: none')).toBe(true);
        expect(css.includes('opacity: 0')).toBe(true);
    });

    it('keeps phone AI chat typography readable (input >=16px, message >=15px)', () => {
        const css = readStyleSheet();
        const inputBlock = extractRuleBlock(css, 'body.layout-mode-phone #chat-input');
        const messageBlock = extractRuleBlock(css, 'body.layout-mode-phone .chat-message-content');
        const inputFontSize = extractPxValue(inputBlock, 'font-size');
        const messageFontSize = extractPxValue(messageBlock, 'font-size');

        expect(inputBlock.length).toBeGreaterThan(0);
        expect(messageBlock.length).toBeGreaterThan(0);
        expect(Number.isFinite(inputFontSize)).toBe(true);
        expect(Number.isFinite(messageFontSize)).toBe(true);
        expect(inputFontSize).toBeGreaterThanOrEqual(16);
        expect(messageFontSize).toBeGreaterThanOrEqual(15);
    });

    it('defines dedicated narrow-phone layout overrides (<=360px)', () => {
        const css = readStyleSheet();
        expect(css.includes('@media (max-width: 360px)')).toBe(true);
        expect(css.includes('body.layout-mode-phone .ai-tab-content')).toBe(true);
        expect(css.includes('body.layout-mode-phone .chat-message-content')).toBe(true);
    });

    it('defines dedicated phone-landscape layout overrides', () => {
        const css = readStyleSheet();
        expect(css.includes('@media (orientation: landscape)')).toBe(true);
        expect(css.includes('body.layout-mode-phone #ai-panel-header')).toBe(true);
        expect(css.includes('body.layout-mode-phone #chat-input-area')).toBe(true);
    });

    it('defines mobile chat density classes for long/short message readability', () => {
        const css = readStyleSheet();
        expect(css.includes('body.layout-mode-phone .chat-message-content.chat-density-compact')).toBe(true);
        expect(css.includes('body.layout-mode-phone .chat-message-content.chat-density-normal')).toBe(true);
        expect(css.includes('body.layout-mode-phone .chat-message-content.chat-density-relaxed')).toBe(true);
    });

    it('defines phone clear-confirm hint styles for accidental-tap guidance', () => {
        const css = readStyleSheet();
        const block = extractRuleBlock(css, 'body.layout-mode-phone #chat-new-confirm-hint');
        const fontSize = extractPxValue(block, 'font-size');

        expect(block.length).toBeGreaterThan(0);
        expect(css.includes('#chat-new-confirm-hint.visible')).toBe(true);
        expect(Number.isFinite(fontSize)).toBe(true);
        expect(fontSize).toBeGreaterThanOrEqual(12);
    });

    it('reserves right-thumb zone for primary sim toggle and keeps mode buttons in bottom controls', () => {
        const css = readStyleSheet();
        const simToggleBlock = extractRuleBlock(css, 'body.layout-mode-phone .mobile-sim-toggle');
        const selectModeBlock = extractRuleBlock(css, 'body.layout-mode-phone #btn-mobile-mode-select');
        const wireModeBlock = extractRuleBlock(css, 'body.layout-mode-phone #btn-mobile-mode-wire');

        expect(css.includes('right: calc(max(8px, env(safe-area-inset-right)) + 86px)')).toBe(true);
        expect(simToggleBlock.includes('display: inline-flex')).toBe(true);
        expect(selectModeBlock.includes('order:')).toBe(true);
        expect(wireModeBlock.includes('order:')).toBe(true);
    });
});
