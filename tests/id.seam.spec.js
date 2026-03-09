import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('shared entity id seam', () => {
    it('exposes canonical id counter from utils', async () => {
        const idModule = await import('../src/utils/id/EntityIdCounter.js');

        expect(idModule.generateEntityId).toBeTypeOf('function');
        expect(idModule.resetEntityIdCounter).toBeTypeOf('function');
        expect(idModule.updateEntityIdCounterFromExisting).toBeTypeOf('function');
    });

    it('RuntimeActionRouter and HistoryManager depend on utils id seam instead of components', () => {
        const routerSource = readFileSync(resolve(process.cwd(), 'src/app/RuntimeActionRouter.js'), 'utf8');
        const historySource = readFileSync(resolve(process.cwd(), 'src/ui/interaction/HistoryManager.js'), 'utf8');

        expect(routerSource).toContain("../utils/id/EntityIdCounter.js");
        expect(routerSource).not.toContain("../components/Component.js");
        expect(historySource).toContain("../../utils/id/EntityIdCounter.js");
        expect(historySource).not.toContain("../../components/Component.js");
    });

    it('ComponentFactory delegates id generation to shared utils seam', () => {
        const factorySource = readFileSync(resolve(process.cwd(), 'src/components/factory/ComponentFactory.js'), 'utf8');

        expect(factorySource).toContain("../../utils/id/EntityIdCounter.js");
        expect(factorySource).not.toContain('let componentIdCounter = 0');
    });
});
