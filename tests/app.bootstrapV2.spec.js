import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootstrapV2 } from '../src/v2/main/bootstrapV2.js';

describe('bootstrapV2 composition root', () => {
    it('registers app factory and exposes runtime contract shape', () => {
        let capturedCreateApp = null;
        const register = ({ createApp }) => {
            capturedCreateApp = createApp;
            return true;
        };

        class FakeApp {
            constructor() {
                this.chartWorkspace = {};
                this.openAIPanel = () => null;
            }
        }

        const ok = bootstrapV2({
            register,
            AppClass: FakeApp
        });

        expect(ok).toBe(true);
        expect(typeof capturedCreateApp).toBe('function');
        const app = capturedCreateApp();
        expect(app.chartWorkspace).toBeDefined();
        expect(typeof app.openAIPanel).toBe('function');
    });

    it('app runtime source exposes mobile restore runtime contract hooks', () => {
        const runtimePath = resolve(process.cwd(), 'src/app/AppRuntimeV2.js');
        const source = readFileSync(runtimePath, 'utf8');
        expect(source).toContain('mobileRestoreBroker');
        expect(source).toContain('runMobileRestoreAction');
    });


    it('app runtime source composes runtime action router and ui bridge', () => {
        const runtimePath = resolve(process.cwd(), 'src/app/AppRuntimeV2.js');
        const source = readFileSync(runtimePath, 'utf8');
        expect(source).toContain('RuntimeActionRouter');
        expect(source).toContain('RuntimeUiBridge');
        expect(source).toContain('this.actionRouter');
        expect(source).toContain('this.runtimeUiBridge');
    });

    it('main entry delegates startup to bootstrapV2', () => {
        const mainPath = resolve(process.cwd(), 'src/main.js');
        const source = readFileSync(mainPath, 'utf8');
        expect(source).toContain('bootstrapV2');
        expect(source).not.toContain('registerAppBootstrap({');
    });

    it('bootstrapV2 avoids direct v1 monolith dependency assembly', () => {
        const bootstrapPath = resolve(process.cwd(), 'src/v2/main/bootstrapV2.js');
        const source = readFileSync(bootstrapPath, 'utf8');
        expect(source).not.toContain('new Circuit(');
        expect(source).not.toContain('new Renderer(');
        expect(source).not.toContain('new InteractionManager(');
    });
});
