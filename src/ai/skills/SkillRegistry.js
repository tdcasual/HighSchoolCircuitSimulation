/**
 * SkillRegistry.js - lightweight runtime skill container for AI workflows
 */

export class SkillRegistry {
    constructor(skills = []) {
        this.skills = new Map();
        skills.forEach(skill => this.register(skill));
    }

    register(skill) {
        const name = skill?.name;
        const run = skill?.run;
        if (!name || typeof name !== 'string') {
            throw new Error('Invalid skill: missing name');
        }
        if (typeof run !== 'function') {
            throw new Error(`Invalid skill "${name}": missing run()`);
        }
        this.skills.set(name, skill);
        return this;
    }

    has(name) {
        return this.skills.has(name);
    }

    get(name) {
        return this.skills.get(name) || null;
    }

    async run(name, input = {}, context = {}) {
        const skill = this.get(name);
        if (!skill) {
            throw new Error(`Skill not found: ${name}`);
        }
        return skill.run(input, context);
    }
}
