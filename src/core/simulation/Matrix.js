/**
 * Matrix.js - V1 矩阵门面。LU / 零矩阵与 V2 共用 src/utils/linearAlgebra.js。
 */

import { createRuntimeLogger } from '../../utils/Logger.js';
import {
    factorize as factorizeShared,
    solveWithFactorization as solveWithFactorizationShared,
    zeroVector as zeroVectorShared,
    zeros as zerosShared
} from '../../utils/linearAlgebra.js';

export class Matrix {
    static getLogger() {
        if (!Matrix._logger) {
            Matrix._logger = createRuntimeLogger({ scope: 'matrix' });
        }
        return Matrix._logger;
    }

    static setLogger(logger) {
        Matrix._logger = logger || createRuntimeLogger({ scope: 'matrix' });
    }

    static zeros(rows, cols) {
        return zerosShared(rows, cols);
    }

    static zeroVector(n) {
        return zeroVectorShared(n);
    }

    static solve(A, b) {
        const factorization = Matrix.factorize(A);
        if (!factorization) return null;
        return Matrix.solveWithFactorization(factorization, b);
    }

    static factorize(A, options = {}) {
        const factorization = factorizeShared(A, options);
        if (!factorization && options.warnOnFailure !== false) {
            const logger = options.logger || Matrix.getLogger();
            logger?.warn?.('Matrix is singular or nearly singular');
        }
        return factorization;
    }

    static solveWithFactorization(factorization, b) {
        const x = solveWithFactorizationShared(factorization, b);
        if (x === null) {
            Matrix.getLogger()?.warn?.('Matrix is singular or nearly singular');
        }
        return x;
    }
}
