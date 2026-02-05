/**
 * Matrix.js - 矩阵运算工具类
 * 用于MNA（改进节点分析法）的线性方程组求解
 */

export class Matrix {
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
        const n = A.length;
        if (n === 0) return [];

        // 创建增广矩阵 [A|b]
        const augmented = A.map((row, i) => [...row, b[i]]);

        // 高斯消元（带部分主元选取）
        for (let col = 0; col < n; col++) {
            // 找到当前列中绝对值最大的行（部分主元选取）
            let maxRow = col;
            let maxVal = Math.abs(augmented[col][col]);
            
            for (let row = col + 1; row < n; row++) {
                const val = Math.abs(augmented[row][col]);
                if (val > maxVal) {
                    maxVal = val;
                    maxRow = row;
                }
            }

            // 如果主元为零或接近零，矩阵可能奇异
            // 注意：gmin 稳定化可能会让对角元达到 1e-12 量级；阈值应更小以避免误判。
            if (maxVal < 1e-15) {
                console.warn('Matrix is singular or nearly singular');
                return null;
            }

            // 交换行
            if (maxRow !== col) {
                [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
            }

            // 消元
            const pivot = augmented[col][col];
            for (let row = col + 1; row < n; row++) {
                const factor = augmented[row][col] / pivot;
                for (let j = col; j <= n; j++) {
                    augmented[row][j] -= factor * augmented[col][j];
                }
            }
        }

        // 回代
        const x = new Array(n);
        for (let row = n - 1; row >= 0; row--) {
            let sum = augmented[row][n];
            for (let col = row + 1; col < n; col++) {
                sum -= augmented[row][col] * x[col];
            }
            x[row] = sum / augmented[row][row];
        }

        // 处理 NaN 和 Infinity
        for (let i = 0; i < n; i++) {
            if (!isFinite(x[i])) {
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
        console.log(`${name}:`);
        matrix.forEach((row, i) => {
            console.log(`  [${row.map(v => v.toFixed(4).padStart(10)).join(', ')}]`);
        });
    }

    /**
     * 打印向量（调试用）
     * @param {number[]} vector - 向量
     * @param {string} name - 向量名称
     */
    static printVector(vector, name = 'Vector') {
        console.log(`${name}: [${vector.map(v => v.toFixed(4)).join(', ')}]`);
    }
}
