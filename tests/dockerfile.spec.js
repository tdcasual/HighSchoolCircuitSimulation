import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Dockerfile', () => {
    it('uses nginx alpine runtime and exposes 80', () => {
        const content = read('Dockerfile');
        expect(content).toMatch(/FROM nginx:1\.27-alpine/);
        expect(content).toMatch(/EXPOSE 80/);
    });

    it('serves built dist artifacts instead of copying raw src', () => {
        const content = read('Dockerfile');
        expect(content).toMatch(/FROM node:20-alpine AS builder/);
        expect(content).toMatch(/COPY nginx\.conf/);
        expect(content).toMatch(/COPY --from=builder \/app\/dist\/ \/usr\/share\/nginx\/html\//);
        expect(content).not.toMatch(/COPY src \.\/src/);
    });
});

describe('nginx.conf', () => {
    it('serves root and caches static assets', () => {
        const content = read('nginx.conf');
        expect(content).toMatch(/root \/usr\/share\/nginx\/html/);
        expect(content).toMatch(/location ~\* \\\.\(js\|css\|png\|jpg\|jpeg\|gif\|svg\|ico\)\$/);
    });
});
