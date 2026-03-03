/**
 * Matrix.js - 矩阵运算工具类
 * 用于MNA（改进节点分析法）的线性方程组求解
 */

import { createRuntimeLogger } from '../utils/Logger.js';

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

    /**
     * 创建一个 rows x cols 的零矩阵
     * @param {number} rows - 行数
     * @param {number} cols - 列数
     * @returns {number[][]} 零矩阵
     */
    static zeros(rows, cols) {
        return Array.from({ length: rows }, () => Array(cols).fill(0));
    }

    /**
     * 创建一个长度为 n 的零向量
     * @param {number} n - 向量长度
     * @returns {number[]} 零向量
     */
    static zeroVector(n) {
        return Array(n).fill(0);
    }

    /**
     * 克隆矩阵
     * @param {number[][]} matrix - 原矩阵
     * @returns {number[][]} 克隆后的矩阵
     */
    static clone(matrix) {
        return matrix.map(row => [...row]);
    }

    /**
     * 克隆向量
     * @param {number[]} vector - 原向量
     * @returns {number[]} 克隆后的向量
     */
    static cloneVector(vector) {
        return [...vector];
    }

    /**
     * 使用高斯消元法求解线性方程组 Ax = b
     * @param {number[][]} A - 系数矩阵
     * @param {number[]} b - 常数向量
     * @returns {number[]|null} 解向量，如果无解返回null
     */
    static solve(A, b) {
        const factorization = Matrix.factorize(A);
        if (!factorization) return null;
        return Matrix.solveWithFactorization(factorization, b);
    }

    /**
     * 对方阵进行 LU 分解（带部分主元选取）
     * @param {number[][]} A - 方阵
     * @param {{pivotEpsilon?: number, warnOnFailure?: boolean}} [options]
     * @returns {{lu:number[][], pivot:number[], n:number, pivotEpsilon:number}|null}
     */
    static factorize(A, options = {}) {
        const n = A.length;
        if (n === 0) {
            return {
                lu: [],
                pivot: [],
                n: 0,
                pivotEpsilon: 1e-15
            };
        }

        const pivotEpsilon = Number.isFinite(options.pivotEpsilon) ? options.pivotEpsilon : 1e-15;
        const warnOnFailure = options.warnOnFailure !== false;
        const logger = options.logger || Matrix.getLogger();

        const lu = A.map((row) => [...row]);
        const pivot = Array.from({ length: n }, (_, idx) => idx);

        for (let col = 0; col < n; col++) {
            let maxRow = col;
            let maxVal = Math.abs(lu[col][col]);

            for (let row = col + 1; row < n; row++) {
                const val = Math.abs(lu[row][col]);
                if (val > maxVal) {
                    maxVal = val;
                    maxRow = row;
                }
            }

            if (maxVal < pivotEpsilon) {
                if (warnOnFailure) {
                    logger?.warn?.('Matrix is singular or nearly singular');
                }
                return null;
            }

            if (maxRow !== col) {
                [lu[col], lu[maxRow]] = [lu[maxRow], lu[col]];
                [pivot[col], pivot[maxRow]] = [pivot[maxRow], pivot[col]];
            }

            const pivotValue = lu[col][col];
            for (let row = col + 1; row < n; row++) {
                lu[row][col] /= pivotValue;
                const factor = lu[row][col];
                if (factor === 0) continue;
                for (let j = col + 1; j < n; j++) {
                    lu[row][j] -= factor * lu[col][j];
                }
            }
        }

        return {
            lu,
            pivot,
            n,
            pivotEpsilon
        };
    }

    /**
     * 使用 LU 分解结果求解 Ax=b
     * @param {{lu:number[][], pivot:number[], n:number, pivotEpsilon?:number}} factorization
     * @param {number[]} b - 常数向量
     * @returns {number[]|null}
     */
    static solveWithFactorization(factorization, b) {
        if (!factorization || !Array.isArray(factorization.lu) || !Array.isArray(factorization.pivot)) {
            return null;
        }

        const n = factorization.n;
        if (n === 0) return [];

        const lu = factorization.lu;
        const pivot = factorization.pivot;
        const pivotEpsilon = Number.isFinite(factorization.pivotEpsilon) ? factorization.pivotEpsilon : 1e-15;

        const y = new Array(n).fill(0);
        const x = new Array(n).fill(0);

        for (let i = 0; i < n; i++) {
            const rhs = b[pivot[i]] ?? 0;
            let sum = rhs;
            for (let j = 0; j < i; j++) {
                sum -= lu[i][j] * y[j];
            }
            y[i] = sum;
        }

        for (let i = n - 1; i >= 0; i--) {
            let sum = y[i];
            for (let j = i + 1; j < n; j++) {
                sum -= lu[i][j] * x[j];
            }
            const pivotValue = lu[i][i];
            if (Math.abs(pivotValue) < pivotEpsilon) {
                Matrix.getLogger()?.warn?.('Matrix is singular or nearly singular');
                return null;
            }
            x[i] = sum / pivotValue;
        }

        for (let i = 0; i < n; i++) {
            if (!Number.isFinite(x[i])) {
                x[i] = 0;
            }
        }

        return x;
    }

    /**
     * 矩阵乘法 A * B
     * @param {number[][]} A - 矩阵A
     * @param {number[][]} B - 矩阵B
     * @returns {number[][]} 结果矩阵
     */
    static multiply(A, B) {
        const rowsA = A.length;
        const colsA = A[0].length;
        const colsB = B[0].length;
        
        const result = Matrix.zeros(rowsA, colsB);
        
        for (let i = 0; i < rowsA; i++) {
            for (let j = 0; j < colsB; j++) {
                for (let k = 0; k < colsA; k++) {
                    result[i][j] += A[i][k] * B[k][j];
                }
            }
        }
        
        return result;
    }

    /**
     * 矩阵与向量相乘 A * v
     * @param {number[][]} A - 矩阵
     * @param {number[]} v - 向量
     * @returns {number[]} 结果向量
     */
    static multiplyVector(A, v) {
        const n = A.length;
        const result = new Array(n).fill(0);
        
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < v.length; j++) {
                result[i] += A[i][j] * v[j];
            }
        }
        
        return result;
    }

    /**
     * 打印矩阵（调试用）
     * @param {number[][]} matrix - 矩阵
     * @param {string} name - 矩阵名称
     */
    static print(matrix, name = 'Matrix') {
        Matrix.getLogger()?.info?.(`${name}:`);
        matrix.forEach((row) => {
            Matrix.getLogger()?.info?.(`  [${row.map(v => v.toFixed(4).padStart(10)).join(', ')}]`);
        });
    }

    /**
     * 打印向量（调试用）
     * @param {number[]} vector - 向量
     * @param {string} name - 向量名称
     */
    static printVector(vector, name = 'Vector') {
        Matrix.getLogger()?.info?.(`${name}: [${vector.map(v => v.toFixed(4)).join(', ')}]`);
    }
}
