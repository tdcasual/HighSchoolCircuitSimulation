import { describe, it, expect } from 'vitest';
import {
    AI_EVAL_SCENARIO_FILES,
    runAiEvalScenarios
} from '../scripts/benchmark/ai-eval-regression.mjs';

describe('AI eval regression suite', () => {
    it('loads multiple medium/hard scenarios', () => {
        expect(AI_EVAL_SCENARIO_FILES.length).toBeGreaterThanOrEqual(3);
    });

    it('runs mock-mode evaluation and produces metrics', async () => {
        const snapshot = await runAiEvalScenarios({ mode: 'mock' });
        expect(snapshot.scenarioCount).toBe(AI_EVAL_SCENARIO_FILES.length);
        expect(snapshot.totalQuestions).toBeGreaterThan(0);
        expect(snapshot.passRate).toBeGreaterThanOrEqual(0);
        expect(snapshot.avgLatencyMs).toBeGreaterThanOrEqual(0);
        for (const scenario of snapshot.scenarios) {
            expect(scenario.questionCount).toBeGreaterThan(0);
            expect(scenario.questions.length).toBe(scenario.questionCount);
            for (const question of scenario.questions) {
                expect(typeof question.pass).toBe('boolean');
                expect(question.targetEvaluation.total).toBeGreaterThan(0);
            }
        }
    });
});
