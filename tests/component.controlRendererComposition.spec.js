import { describe, expect, it } from 'vitest';
import { SVGRenderer } from '../src/components/Component.js';
import { CONTROL_COMPONENT_RENDERERS } from '../src/components/render/ControlComponentRenderers.js';

describe('Component control renderer composition', () => {
    it('composes control-family render methods onto SVGRenderer from the extracted table', () => {
        expect(SVGRenderer.renderRelay).toBe(CONTROL_COMPONENT_RENDERERS.renderRelay);
        expect(SVGRenderer.renderRheostat).toBe(CONTROL_COMPONENT_RENDERERS.renderRheostat);
        expect(SVGRenderer.renderSwitch).toBe(CONTROL_COMPONENT_RENDERERS.renderSwitch);
        expect(SVGRenderer.renderSPDTSwitch).toBe(CONTROL_COMPONENT_RENDERERS.renderSPDTSwitch);
        expect(SVGRenderer.renderFuse).toBe(CONTROL_COMPONENT_RENDERERS.renderFuse);
        expect(SVGRenderer.renderBlackBox).toBe(CONTROL_COMPONENT_RENDERERS.renderBlackBox);
    });
});
