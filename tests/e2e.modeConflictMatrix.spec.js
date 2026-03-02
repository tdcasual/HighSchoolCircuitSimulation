import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function toOutput(result) {
    const stdout = typeof result?.stdout === 'string' ? result.stdout : '';
    const stderr = typeof result?.stderr === 'string' ? result.stderr : '';
    return `${stdout}${stderr}`.trim();
}

describe('mode conflict matrix e2e harness', () => {
    it('mode-conflict-matrix script exits non-zero on any conflict', () => {
        const tempRoot = mkdtempSync(join(tmpdir(), 'mode-conflict-matrix-'));

        try {
            const fixturePath = resolve(tempRoot, 'mode-conflict-fixture.json');
            const outputDir = resolve(tempRoot, 'output', 'e2e', 'mode-conflict');
            const summaryPath = resolve(outputDir, 'matrix-summary.json');
            const scriptPath = resolve(process.cwd(), 'scripts/e2e/mode-conflict-matrix.mjs');

            writeFileSync(fixturePath, JSON.stringify({
                rows: [
                    {
                        pointerType: 'touch',
                        layoutMode: 'phone',
                        classroomLevel: 'standard',
                        embedReadonly: true,
                        expectedMode: 'wire',
                        snapshot: {
                            mode: 'conflict',
                            activeModes: ['wire', 'endpoint-edit'],
                            hasConflict: true
                        }
                    }
                ]
            }, null, 2), 'utf8');

            expect(existsSync(scriptPath)).toBe(true);

            const result = spawnSync(
                'node',
                [
                    scriptPath,
                    '--fixture',
                    fixturePath,
                    '--output-dir',
                    outputDir
                ],
                {
                    cwd: tempRoot,
                    encoding: 'utf8',
                    stdio: 'pipe'
                }
            );

            const output = toOutput(result);
            expect(result.status).not.toBe(0);
            expect(output).toContain('[mode-conflict-matrix] conflicts=1');
            expect(output).toContain('[mode-conflict-matrix] detected mode conflicts');
            expect(existsSync(summaryPath)).toBe(true);
        } finally {
            rmSync(tempRoot, { recursive: true, force: true });
        }
    });
});
