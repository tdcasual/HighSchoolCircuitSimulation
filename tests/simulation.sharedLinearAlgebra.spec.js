import { describe, expect, it } from 'vitest';
import { Matrix } from '../src/core/simulation/Matrix.js';
import { buildSystemMatrixCacheKey as buildCacheKeyV1 } from '../src/core/simulation/SolverMatrixCacheKeyBuilder.js';
import {
    buildSystemMatrixCacheKey as buildCacheKeyV2,
    factorize as factorizeV2,
    stampResistor as stampResistorV2
} from '../src/v2/simulation/LinearAlgebraV2.js';
import { buildSystemMatrixCacheKey } from '../src/utils/buildSystemMatrixCacheKey.js';
import { factorize, stampResistor } from '../src/utils/linearAlgebra.js';

describe('shared linear algebra', () => {
    it('re-exports the same stamp, factorize, and cache-key functions from V1 and V2 wrappers', () => {
        expect(stampResistorV2).toBe(stampResistor);
        expect(factorizeV2).toBe(factorize);
        expect(buildCacheKeyV1).toBe(buildSystemMatrixCacheKey);
        expect(buildCacheKeyV2).toBe(buildSystemMatrixCacheKey);
    });

    it('factorizes the same 2x2 system as Matrix.factorize', () => {
        const A = [
            [2, -1],
            [-1, 2]
        ];
        const shared = factorize(A);
        const viaMatrix = Matrix.factorize(A, { warnOnFailure: false });
        expect(viaMatrix).toEqual(shared);
        expect(shared.n).toBe(2);
    });
});
