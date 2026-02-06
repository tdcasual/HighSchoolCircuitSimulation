/**
 * AnswerVerifySkill.js
 * Append a compact verification section for numeric claims.
 */

function quantityLabel(quantity) {
    switch (quantity) {
        case 'current': return '电流';
        case 'voltage': return '电压';
        case 'power': return '功率';
        default: return '数值';
    }
}

function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    const abs = Math.abs(number);
    if (abs >= 1000) return number.toFixed(1);
    if (abs >= 10) return number.toFixed(2);
    return number.toFixed(3);
}

function formatValue(value, unit) {
    return `${formatNumber(value)}${unit || ''}`;
}

function composeCheckLine(check = {}) {
    const label = check?.component?.label || check?.component?.id || '未定位元件';
    const quantity = quantityLabel(check.quantity);
    const unit = check.unit || '';
    if (check.status === 'verified') {
        return `- [通过] ${label}${quantity}：回答 ${formatValue(check.expectedValue, unit)}，仿真 ${formatValue(check.actualValue, unit)}，误差 ${formatValue(check.delta, unit)}`;
    }
    if (check.status === 'mismatch') {
        return `- [偏差] ${label}${quantity}：回答 ${formatValue(check.expectedValue, unit)}，仿真 ${formatValue(check.actualValue, unit)}，误差 ${formatValue(check.delta, unit)}（容差 ${formatValue(check.tolerance, unit)}）`;
    }
    if (check.status === 'missing-data') {
        return `- [缺失] ${label}${quantity}：元件数据不可用，未完成校验`;
    }
    return `- [未映射] ${quantity} ${formatValue(check.expectedValue, unit)}：${check.reason || '未定位到对应元件'}`;
}

export const AnswerVerifySkill = {
    name: 'answer_verify',

    run(input = {}, _context = {}) {
        const answer = String(input.answer || '').trim();
        const checks = Array.isArray(input.checks) ? input.checks : [];
        if (!answer) return '';
        if (answer.includes('### 数值核对')) {
            return answer;
        }
        if (checks.length === 0) {
            return `${answer}\n\n### 数值核对\n- 未检测到可核对的数值结论。`;
        }

        const lines = checks.slice(0, 8).map(composeCheckLine);
        const mismatchCount = checks.filter(check => check.status === 'mismatch').length;
        if (mismatchCount > 0) {
            lines.push('- [提示] 存在数值偏差，建议以仿真器实时读数为准并复核推导步骤。');
        }
        return `${answer}\n\n### 数值核对\n${lines.join('\n')}`;
    }
};
