/**
 * QuestionPlanningSkill.js
 * Build a lightweight execution plan for the current question.
 */

const NUMERIC_KEYWORDS = [
    '多少', '多大', '计算', '求', '数值', '读数', '电流', '电压', '功率', '电阻', '电容', '电感'
];

const TOPOLOGY_KEYWORDS = [
    '串联', '并联', '拓扑', '节点', '回路', '连接', '短路', '开路', '为什么'
];

function includesKeyword(text, keywords = []) {
    return keywords.some((keyword) => text.includes(keyword));
}

function detectFocusQuantities(questionText = '') {
    const quantities = [];
    if (questionText.includes('电流')) quantities.push('current');
    if (questionText.includes('电压')) quantities.push('voltage');
    if (questionText.includes('功率')) quantities.push('power');
    if (quantities.length === 0 && includesKeyword(questionText, NUMERIC_KEYWORDS)) {
        quantities.push('current', 'voltage');
    }
    return [...new Set(quantities)];
}

export const QuestionPlanningSkill = {
    name: 'question_plan',

    run(input = {}, _context = {}) {
        const question = String(input.question || '').trim();
        const normalized = question.toLowerCase();
        const isNumeric = includesKeyword(normalized, NUMERIC_KEYWORDS);
        const isTopology = includesKeyword(normalized, TOPOLOGY_KEYWORDS);
        const focusQuantities = detectFocusQuantities(normalized);

        const mode = isNumeric ? 'compute-first' : 'explain-first';
        const steps = [];
        steps.push('refresh-simulation');
        steps.push('capture-circuit-snapshot');
        if (isTopology) {
            steps.push('validate-topology-assumptions');
        }
        if (isNumeric) {
            steps.push('provide-numeric-evidence');
            steps.push('post-verify-claims');
        }
        steps.push('compose-final-answer');

        return {
            mode,
            requiresNumericVerification: isNumeric,
            includeTopology: true,
            focusQuantities,
            evidenceLimit: isNumeric ? 6 : 4,
            knowledgeLimit: isNumeric ? 4 : 3,
            steps
        };
    }
};
