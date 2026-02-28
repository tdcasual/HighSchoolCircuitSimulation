# Observation UX & Interaction Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the observation system from a dense settings-centric panel into a smoother mobile-first experience with clearer UI, lower interaction cost, and explicit chart interaction behavior while keeping existing simulation correctness.

**Architecture:** Split the current monolithic observation panel responsibilities into three layers: (1) persisted observation state schema, (2) UI/card interaction controllers, and (3) rendering engine for charts/gauges. Add a two-level UX (`basic` and `advanced`) plus quick presets and chart cursor interactions. Keep backward compatibility with existing saved `observation` JSON by migration in normalization.

**Tech Stack:** Vanilla ES modules, Canvas2D, Vitest, Playwright-based E2E scripts, GitHub Actions CI.

**Skills Required During Execution:** @superpowers:test-driven-development, @superpowers:systematic-debugging, @superpowers:verification-before-completion

---

### Task 1: Observation State Schema V2 (UX mode + panel preferences)

**Files:**
- Create: `src/ui/observation/ObservationPreferences.js`
- Modify: `src/ui/observation/ObservationState.js`
- Modify: `tests/observationState.spec.js`
- Test: `tests/observationState.spec.js`

**Step 1: Write the failing test**

```js
it('normalizes observation ui preferences with backward compatibility', () => {
    const state = normalizeObservationState({
        sampleIntervalMs: 40,
        plots: [],
        ui: { mode: 'basic', collapsedCards: ['plot_1'], showGaugeSection: true }
    }, {
        defaultYSourceId: 'R1',
        defaultPlotCount: 1
    });

    expect(state.ui.mode).toBe('basic');
    expect(state.ui.showGaugeSection).toBe(true);
    expect(Array.isArray(state.ui.collapsedCards)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/observationState.spec.js`
Expected: FAIL with missing `ui` normalization / undefined fields.

**Step 3: Write minimal implementation**

```js
// ObservationPreferences.js
export const ObservationUIModes = Object.freeze({
    Basic: 'basic',
    Advanced: 'advanced'
});

export function normalizeObservationUI(raw = {}) {
    const mode = raw?.mode === ObservationUIModes.Advanced
        ? ObservationUIModes.Advanced
        : ObservationUIModes.Basic;
    const collapsedCards = Array.isArray(raw?.collapsedCards)
        ? raw.collapsedCards.filter(Boolean)
        : [];
    return {
        mode,
        collapsedCards,
        showGaugeSection: raw?.showGaugeSection !== false
    };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/observationState.spec.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/observation/ObservationPreferences.js src/ui/observation/ObservationState.js tests/observationState.spec.js
git commit -m "feat(observation): add schema v2 ui preference normalization"
```

### Task 2: Observation Top Toolbar + Mode Toggle + Preset Entry

**Files:**
- Modify: `src/ui/ObservationPanel.js`
- Modify: `index.html`
- Modify: `css/style.css`
- Create: `tests/observationPanel.uxMode.spec.js`
- Test: `tests/observationPanel.uxMode.spec.js`

**Step 1: Write the failing test**

```js
it('renders mode toggle and quick preset buttons', () => {
    const panel = createPanelHarness();
    panel.initializeUI();

    expect(panel.root.querySelector('[data-observation-mode="basic"]')).toBeTruthy();
    expect(panel.root.querySelector('[data-observation-mode="advanced"]')).toBeTruthy();
    expect(panel.root.querySelector('[data-observation-preset="voltage-time"]')).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/observationPanel.uxMode.spec.js`
Expected: FAIL because toolbar/mode/preset elements do not exist.

**Step 3: Write minimal implementation**

```js
const modeBar = createElement('div', { className: 'observation-mode-bar' });
modeBar.appendChild(createElement('button', {
    textContent: '基础模式',
    attrs: { type: 'button', 'data-observation-mode': 'basic' }
}));
modeBar.appendChild(createElement('button', {
    textContent: '高级模式',
    attrs: { type: 'button', 'data-observation-mode': 'advanced' }
}));

const presetBar = createElement('div', { className: 'observation-preset-bar' });
presetBar.appendChild(createElement('button', {
    textContent: 'U-t',
    attrs: { type: 'button', 'data-observation-preset': 'voltage-time' }
}));
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/observationPanel.uxMode.spec.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/ObservationPanel.js index.html css/style.css tests/observationPanel.uxMode.spec.js
git commit -m "feat(observation): add mode toggle and quick preset toolbar"
```

### Task 3: Extract Plot Card Interaction Logic from ObservationPanel

**Files:**
- Create: `src/ui/observation/ObservationPlotCardController.js`
- Modify: `src/ui/ObservationPanel.js`
- Create: `tests/observationPlotCardController.spec.js`
- Test: `tests/observationPlotCardController.spec.js`

**Step 1: Write the failing test**

```js
it('binds source/quantity/transform changes through card controller callbacks', () => {
    const onChange = vi.fn();
    const controller = new ObservationPlotCardController({ onChange });
    controller.mount(createPlotFixture());

    controller.elements.yTransformSelect.value = 'abs';
    controller.elements.yTransformSelect.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        type: 'plot-transform-change',
        axis: 'y',
        value: 'abs'
    }));
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/observationPlotCardController.spec.js`
Expected: FAIL because controller file/class is missing.

**Step 3: Write minimal implementation**

```js
export class ObservationPlotCardController {
    constructor({ onChange }) {
        this.onChange = onChange;
    }

    mount(plot) {
        this.plot = plot;
        // wire DOM events -> this.onChange(payload)
    }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/observationPlotCardController.spec.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/observation/ObservationPlotCardController.js src/ui/ObservationPanel.js tests/observationPlotCardController.spec.js
git commit -m "refactor(observation): extract plot card interaction controller"
```

### Task 4: Chart Interaction Upgrade (Crosshair + Hold-to-Freeze + Readout)

**Files:**
- Create: `src/ui/observation/ObservationChartInteraction.js`
- Modify: `src/ui/ObservationPanel.js`
- Modify: `css/style.css`
- Create: `tests/observationChartInteraction.spec.js`
- Test: `tests/observationChartInteraction.spec.js`

**Step 1: Write the failing test**

```js
it('freezes cursor readout on long press and resumes on second tap', () => {
    const model = createInteractionModel();
    model.onPointerDown({ x: 100, y: 60, pointerType: 'touch', time: 0 });
    model.onPointerMove({ x: 110, y: 62, time: 450 });

    expect(model.isFrozen()).toBe(true);
    expect(model.getReadout().x).toBeCloseTo(110, 6);

    model.onPointerDown({ x: 110, y: 62, pointerType: 'touch', time: 900 });
    expect(model.isFrozen()).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/observationChartInteraction.spec.js`
Expected: FAIL because interaction model is missing.

**Step 3: Write minimal implementation**

```js
export class ObservationChartInteraction {
    constructor({ holdMs = 350 } = {}) {
        this.holdMs = holdMs;
        this.frozen = false;
        this.readout = null;
    }

    onPointerDown(evt) { /* set pending hold */ }
    onPointerMove(evt) { /* update readout / freeze when threshold reached */ }
    isFrozen() { return this.frozen; }
    getReadout() { return this.readout; }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/observationChartInteraction.spec.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/observation/ObservationChartInteraction.js src/ui/ObservationPanel.js css/style.css tests/observationChartInteraction.spec.js
git commit -m "feat(observation): add chart cursor and hold-to-freeze interaction"
```

### Task 5: Quick Presets from Selected Component/Wire/Probe

**Files:**
- Modify: `src/ui/ObservationPanel.js`
- Modify: `src/ui/interaction/SelectionPanelController.js`
- Modify: `tests/observationPanel.quickBind.spec.js`
- Create: `tests/observationPanel.presetFactory.spec.js`
- Test: `tests/observationPanel.quickBind.spec.js`
- Test: `tests/observationPanel.presetFactory.spec.js`

**Step 1: Write the failing test**

```js
it('creates current-time preset for selected wire current probe', () => {
    const preset = createObservationPreset({
        sourceId: '__probe__:P2',
        probeType: 'WireCurrentProbe',
        preferred: 'time'
    });

    expect(preset.x.sourceId).toBe('__time__');
    expect(preset.y.quantityId).toBe('I');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/observationPanel.quickBind.spec.js tests/observationPanel.presetFactory.spec.js`
Expected: FAIL because preset factory does not exist.

**Step 3: Write minimal implementation**

```js
function createObservationPreset(ctx) {
    if (ctx.probeType === 'WireCurrentProbe') {
        return {
            x: { sourceId: '__time__', quantityId: 't' },
            y: { sourceId: ctx.sourceId, quantityId: 'I' }
        };
    }
    // voltage/default fallback
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/observationPanel.quickBind.spec.js tests/observationPanel.presetFactory.spec.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/ObservationPanel.js src/ui/interaction/SelectionPanelController.js tests/observationPanel.quickBind.spec.js tests/observationPanel.presetFactory.spec.js
git commit -m "feat(observation): add context-aware quick presets"
```

### Task 6: Mobile UX Hardening (Card Collapse + Dense Mode + Sticky Controls)

**Files:**
- Modify: `src/ui/ObservationPanel.js`
- Modify: `css/style.css`
- Modify: `src/ui/ResponsiveLayoutController.js`
- Create: `tests/observationPanel.mobileUx.spec.js`
- Test: `tests/observationPanel.mobileUx.spec.js`

**Step 1: Write the failing test**

```js
it('collapses plot controls in basic mode on phone layout', () => {
    const panel = createPanelHarness({ bodyClass: 'layout-mode-phone' });
    panel.setMode('basic');
    panel.addPlot();

    const card = panel.plots[0].elements.card;
    expect(card.classList.contains('observation-card-collapsed')).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/observationPanel.mobileUx.spec.js`
Expected: FAIL because collapse mode is not implemented.

**Step 3: Write minimal implementation**

```js
applyMobileModeForPlotCard(plot) {
    const shouldCollapse = this.currentMode === 'basic' && this.isPhoneLayout();
    plot.elements.card.classList.toggle('observation-card-collapsed', shouldCollapse);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/observationPanel.mobileUx.spec.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/ObservationPanel.js css/style.css src/ui/ResponsiveLayoutController.js tests/observationPanel.mobileUx.spec.js
git commit -m "feat(observation): improve phone-mode card density and sticky controls"
```

### Task 7: Rendering Safety + Regression Coverage

**Files:**
- Modify: `src/ui/ObservationPanel.js`
- Modify: `tests/observationPanel.sampleCache.spec.js`
- Create: `tests/observationPanel.renderLifecycle.spec.js`
- Create: `scripts/e2e/observation-touch-regression.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/observationPanel.renderLifecycle.spec.js`

**Step 1: Write the failing test**

```js
it('does not schedule duplicate raf renders for batched updates', () => {
    const panel = createPanelHarness();
    panel.requestRender({ onlyIfActive: false });
    panel.requestRender({ onlyIfActive: false });

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/observationPanel.renderLifecycle.spec.js`
Expected: FAIL with incorrect render scheduling behavior.

**Step 3: Write minimal implementation**

```js
requestRender(options = {}) {
    if (options.onlyIfActive && !this.isObservationActive()) return;
    if (this._renderRaf) return;
    this._renderRaf = window.requestAnimationFrame(() => {
        this._renderRaf = 0;
        this.renderAll();
    });
}
```

**Step 4: Run tests + e2e to verify it passes**

Run:
- `npm test -- tests/observationPanel.renderLifecycle.spec.js tests/observationPanel.sampleCache.spec.js`
- `node scripts/e2e/observation-touch-regression.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/ui/ObservationPanel.js tests/observationPanel.sampleCache.spec.js tests/observationPanel.renderLifecycle.spec.js scripts/e2e/observation-touch-regression.mjs package.json .github/workflows/ci.yml
git commit -m "test(observation): add render lifecycle and mobile observation e2e regression coverage"
```

### Task 8: Final Verification + Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/audits/observation-ui/README.md`
- Verify only

**Step 1: Add usage docs and migration notes**

```md
## Observation v2
- Basic/Advanced mode
- Quick presets
- Chart long-press freeze readout
- Backward-compatible observation state migration
```

**Step 2: Run focused regression suite**

Run:
`npm test -- tests/observationMath.spec.js tests/observationState.spec.js tests/observationSources.spec.js tests/observationPanel.quickBind.spec.js tests/observationPanel.sampleCache.spec.js tests/observationPanel.uxMode.spec.js tests/observationPlotCardController.spec.js tests/observationChartInteraction.spec.js tests/observationPanel.mobileUx.spec.js tests/observationPanel.renderLifecycle.spec.js`
Expected: all PASS.

**Step 3: Run full project quality gate**

Run:
`npm run check`
Expected: lint/format/test all pass (or only pre-existing warnings).

**Step 4: Commit docs and audit notes**

```bash
git add README.md docs/audits/observation-ui/README.md
git commit -m "docs(observation): document v2 ux and migration notes"
```

**Step 5: Prepare handoff summary**

```md
- UX improvements: mode switch, presets, chart interactions
- Architecture changes: extracted card/interaction layers
- Stability: added render lifecycle + e2e regression
```

