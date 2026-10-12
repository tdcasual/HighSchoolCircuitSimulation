import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('nginx classroom CSP', () => {
    it('keeps frame-ancestors * and adds fail-closed fetch directives', () => {
        const conf = readFileSync(resolve(process.cwd(), 'nginx.conf'), 'utf8');
        expect(conf).toContain('frame-ancestors *');
        expect(conf).toContain("default-src 'self'");
        expect(conf).toContain("script-src 'self' 'unsafe-inline'");
        expect(conf).toContain("connect-src 'self' https: http: ws: wss:");
        expect(conf).not.toMatch(/script-src 'none'/);
    });
});
