import { describe, expect, it } from 'vitest';
import { setSimulationControlsRunning, setStatusText } from '../src/app/SimulationUiState.js';

function createDocumentStub(nodesById = {}) {
    return {
        getElementById(id) {
            return nodesById[id] || null;
        }
    };
}

function createClassList() {
    const classes = new Set();
    return {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); }
    };
}

describe('SimulationUiState', () => {
    it('does not throw when simulation control nodes are missing', () => {
        const doc = createDocumentStub();
        expect(() => setSimulationControlsRunning(true, { document: doc })).not.toThrow();
        expect(() => setSimulationControlsRunning(false, { document: doc })).not.toThrow();
        expect(() => setStatusText('ready', { document: doc })).not.toThrow();
    });

    it('updates desktop and mobile simulation controls for running and stopped states', () => {
        const desktopRun = { disabled: false };
        const desktopStop = { disabled: true };
        const mobileRun = { disabled: false };
        const mobileStop = { disabled: true };
        const mobileToggle = {
            textContent: '',
            setAttribute(name, value) {
                this[name] = value;
            },
            classList: createClassList()
        };
        const simulationStatus = {
            textContent: '',
            classList: createClassList()
        };
        const doc = createDocumentStub({
            'btn-run': desktopRun,
            'btn-stop': desktopStop,
            'btn-mobile-run': mobileRun,
            'btn-mobile-stop': mobileStop,
            'btn-mobile-sim-toggle': mobileToggle,
            'simulation-status': simulationStatus
        });

        setSimulationControlsRunning(true, { document: doc });
        expect(desktopRun.disabled).toBe(true);
        expect(desktopStop.disabled).toBe(false);
        expect(mobileRun.disabled).toBe(true);
        expect(mobileStop.disabled).toBe(false);
        expect(mobileToggle.textContent).toBe('停止');
        expect(mobileToggle['aria-pressed']).toBe('true');
        expect(mobileToggle.classList.contains('running')).toBe(true);
        expect(simulationStatus.textContent).toBe('模拟: 运行中');
        expect(simulationStatus.classList.contains('running')).toBe(true);

        setSimulationControlsRunning(false, { document: doc });
        expect(desktopRun.disabled).toBe(false);
        expect(desktopStop.disabled).toBe(true);
        expect(mobileRun.disabled).toBe(false);
        expect(mobileStop.disabled).toBe(true);
        expect(mobileToggle.textContent).toBe('运行');
        expect(mobileToggle['aria-pressed']).toBe('false');
        expect(mobileToggle.classList.contains('running')).toBe(false);
        expect(simulationStatus.textContent).toBe('模拟: 停止');
        expect(simulationStatus.classList.contains('running')).toBe(false);
    });

    it('updates status text only when status node exists', () => {
        const statusNode = { textContent: '' };
        const withStatusDoc = createDocumentStub({ 'status-text': statusNode });
        const noStatusDoc = createDocumentStub();

        setStatusText('模拟运行中', { document: withStatusDoc });
        expect(statusNode.textContent).toBe('模拟运行中');

        expect(() => setStatusText('ignored', { document: noStatusDoc })).not.toThrow();
    });

    it('does not throw when classList add/remove are non-callable', () => {
        const mobileToggle = {
            textContent: '',
            setAttribute: () => {},
            classList: {
                add: {},
                remove: {}
            }
        };
        const simulationStatus = {
            textContent: '',
            classList: {
                add: {},
                remove: {}
            }
        };
        const doc = createDocumentStub({
            'btn-mobile-sim-toggle': mobileToggle,
            'simulation-status': simulationStatus
        });

        expect(() => setSimulationControlsRunning(true, { document: doc })).not.toThrow();
        expect(() => setSimulationControlsRunning(false, { document: doc })).not.toThrow();
    });
});
