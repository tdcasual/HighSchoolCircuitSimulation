import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Dockerfile', () => {
    it('uses nginx alpine base and exposes 80', () => {
        const content = read('Dockerfile');
        expect(content).toMatch(/FROM nginx:1\.27-alpine/);
        expect(content).toMatch(/EXPOSE 80/);
    });

    it('copies expected assets and nginx.conf', () => {
        const content = read('Dockerfile');
        expect(content).toMatch(/COPY nginx\.conf/);
        expect(content).toMatch(/COPY index\.html/);
        expect(content).toMatch(/COPY embed\.html/);
        expect(content).toMatch(/COPY deploycircuit\.js/);
        expect(content).toMatch(/COPY css/);
        expect(content).toMatch(/COPY src/);
    });
});

describe('nginx.conf', () => {
    it('serves root and caches static assets', () => {
        const content = read('nginx.conf');
        expect(content).toMatch(/root \/usr\/share\/nginx\/html/);
        expect(content).toMatch(/location ~\* \\\.\(js\|css\|png\|jpg\|jpeg\|gif\|svg\|ico\)\$/);
    });
});
