/**
 * OpenAIClient.js - OpenAI API 客户端
 * 支持 OpenAI 兼容的 API 端点
 */

export class OpenAIClient {
    constructor() {
        this.config = this.loadConfig();
        this.cachedPrompt = null;
    }

    get PUBLIC_CONFIG_KEY() {
        return 'ai_config';
    }

    get SESSION_KEY_KEY() {
        return 'ai_session_key';
    }

    /**
     * 从 localStorage 加载配置
     */
    loadConfig() {
        const defaultConfig = {
            apiEndpoint: 'https://api.openai.com/v1/chat/completions',
            apiKey: '',
            visionModel: 'gpt-4o-mini-vision',
            textModel: 'gpt-4o-mini',
            maxTokens: 2000,
            requestTimeout: 20000,
            retryAttempts: 2,
            retryDelayMs: 600
        };

        const safeGet = (getter, fallback = null) => {
            try {
                return getter();
            } catch (_) {
                return fallback;
            }
        };

        const savedPublic = safeGet(() => localStorage.getItem(this.PUBLIC_CONFIG_KEY));
        const sessionKey = safeGet(() => sessionStorage.getItem(this.SESSION_KEY_KEY)) || '';
        try {
            const merged = savedPublic ? { ...defaultConfig, ...JSON.parse(savedPublic) } : defaultConfig;
            return { ...merged, apiKey: sessionKey };
        } catch (e) {
            console.warn('Failed to load AI config, using defaults.', e);
            return defaultConfig;
        }
    }

    /**
     * 保存配置到 localStorage
     */
    saveConfig(config) {
        const { apiKey, ...rest } = config;
        const normalizedEndpoint = this.normalizeEndpoint(rest.apiEndpoint);
        this.config = { ...this.config, ...rest, apiEndpoint: normalizedEndpoint, apiKey: apiKey ?? this.config.apiKey };

        const safeSet = (setter) => {
            try { setter(); } catch (_) { /* ignore in non-browser */ }
        };

        safeSet(() => localStorage.setItem(this.PUBLIC_CONFIG_KEY, JSON.stringify({
            apiEndpoint: this.config.apiEndpoint,
            visionModel: this.config.visionModel,
            textModel: this.config.textModel,
            maxTokens: this.config.maxTokens,
            requestTimeout: this.config.requestTimeout,
            retryAttempts: this.config.retryAttempts,
            retryDelayMs: this.config.retryDelayMs
        })));

        if (apiKey !== undefined) {
            safeSet(() => {
                if (apiKey) {
                    sessionStorage.setItem(this.SESSION_KEY_KEY, apiKey);
                } else {
                    sessionStorage.removeItem(this.SESSION_KEY_KEY);
                }
            });
        }
    }

    clearApiKey() {
        this.config.apiKey = '';
        try {
            sessionStorage.removeItem(this.SESSION_KEY_KEY);
        } catch (_) {
            // ignore
        }
    }

    /**
     * 测试 API 连接
     */
    async testConnection() {
        if (!this.config.apiKey) {
            throw new Error('请先设置 API 密钥');
        }

        try {
            const response = await this.callAPI([
                { role: 'user', content: 'Hello' }
            ], this.config.textModel, 10);
            
            return { success: true, message: '连接成功!' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * 图片转电路 JSON
     */
    async convertImageToCircuit(imageBase64) {
        if (!this.config.apiKey) {
            throw new Error('请先在设置中配置 API 密钥');
        }

        // 读取转换 Prompt
        const conversionPrompt = await this.getCircuitConversionPrompt();

        const messages = [
            {
                role: 'system',
                content: '你是一个专业的电路图识别助手。请根据用户上传的电路图图片，严格按照提供的格式规范输出 JSON，禁止输出解释性文字。仅返回一个 JSON 代码块，不要额外前后缀。'
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: conversionPrompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${imageBase64}`
                        }
                    }
                ]
            }
        ];

        try {
            const response = await this.callAPI(messages, this.config.visionModel, 2000);
            
            // 提取 JSON
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                            response.match(/\{[\s\S]*"components"[\s\S]*\}/);
            
            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                return JSON.parse(jsonStr);
            } else {
                throw new Error('AI 响应中未找到有效的 JSON 格式');
            }
        } catch (error) {
            console.error('Circuit conversion error:', error);
            throw new Error(`转换失败: ${error.message}`);
        }
    }

    /**
     * 物理问题解释
     */
    async explainCircuit(question, circuitState) {
        if (!this.config.apiKey) {
            throw new Error('请先在设置中配置 API 密钥');
        }

        const systemPrompt = `你是一位经验丰富、讲解透彻的高中物理名师，深谙电学与电路分析，采用“学习模式”与学生互动讲解电路。
要求：
- 语言简洁、贴近高中课程，不引入超纲（大学/微积分/复阻抗）内容。
- 使用欧姆定律、串并联规律、功率/能量守恒等基础知识。
- 先给出核心回答，再用 3-5 步简明推理说明；每步点出物理依据。
- 适度反问/小测验：给 1-2 个简短检查题（如“R1 电流如何变化？选 A/B”或“请代入公式算出电流约多少 A”），鼓励学生参与。
- 如需要计算，给出关键中间值，数值保留 2-3 位有效数字；明确公式出处。
- 发现题意不全时，先澄清再作答。
- 不使用过于口语化的表情/Emoji。
- 输出使用 Markdown，公式可用 LaTeX（例如 $U=IR$）；必要时用列表呈现。
- 必须使用提供的“连接拓扑”信息，按导线连接关系推理，不要自行猜测未提供的串并联结构；若拓扑缺失或不确定，请先说明假设再计算。
- 结构建议：先给一句话结论，然后“推理步骤”分条，再给“检查题”，最后“公式/关键数值”汇总。
- 已提供的节点映射格式：节点N: 组件ID:端子索引,...；以及导线列表 wire: A:0 -> B:1。端子含义：电源 0=负极/1=正极；电阻/电容/灯泡/电压表/电流表 0=左(或上)/1=右(或下)；滑变 0=左 1=右 2=滑片；开关 0=左 1=右；电机/其他双端器件同上。推理必须基于这些节点/导线关系，不可擅自假设并联或串联。
- 当拓扑或参数存在不确定时，先明确假设并给出对结论的影响范围（例如“若 R2 未接入，则电流为 0”）。

当前电路状态（供推理参考）：
${circuitState}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
        ];

        try {
            return await this.callAPI(messages, this.config.textModel, 1500);
        } catch (error) {
            console.error('Explanation error:', error);
            throw new Error(`解释失败: ${error.message}`);
        }
    }

    /**
     * 获取可用模型列表
     */
    async listModels() {
        if (!this.config.apiKey) {
            throw new Error('请先在设置中配置 API 密钥');
        }

        const apiEndpoint = this.normalizeEndpoint(this.config.apiEndpoint);
        let base;
        if (/\/v1\/[^/]+$/.test(apiEndpoint)) {
            base = apiEndpoint.replace(/\/v1\/[^/]+$/, '/v1/models');
        } else if (apiEndpoint.endsWith('/v1')) {
            base = `${apiEndpoint}/models`;
        } else if (/\/v1\//.test(apiEndpoint)) {
            base = apiEndpoint.split('/v1/')[0] + '/v1/models';
        } else {
            base = apiEndpoint.endsWith('/') ? `${apiEndpoint}v1/models` : `${apiEndpoint}/v1/models`;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.requestTimeout || 20000);

        try {
            const response = await fetch(base, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                signal: controller.signal
            });
            clearTimeout(timer);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('API 密钥无效或无访问权限');
                }
                throw new Error(`获取模型失败: HTTP ${response.status}`);
            }
            const data = await response.json();
            const ids = (data.data || []).map(m => m.id).filter(Boolean);
            return ids;
        } catch (err) {
            clearTimeout(timer);
            if (err?.name === 'AbortError') {
                throw new Error('请求超时');
            }
            throw err;
        }
    }

    /**
     * 调用 OpenAI API
     */
    async callAPI(messages, model, maxTokens = null) {
        const apiKey = this.config.apiKey;
        if (!apiKey) {
            throw new Error('请先在设置中配置 API 密钥');
        }

        const primaryUseResponsesApi = this.shouldUseResponsesApi(model);
        let useResponsesApi = primaryUseResponsesApi;
        let fallbackTried = false;

        const attempts = Math.max(1, this.config.retryAttempts || 1);
        let delay = Math.max(200, this.config.retryDelayMs || 200);
        let lastError;

        for (let attempt = 0; attempt < attempts; attempt++) {
            const requestBody = this.buildRequestBody(messages, model, maxTokens, useResponsesApi);
            const apiUrl = this.resolveApiEndpoint(useResponsesApi);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.config.requestTimeout || 20000);
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                clearTimeout(timer);

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        throw new Error('API 密钥无效或无访问权限');
                    }
                    if (response.status === 429 || response.status >= 500) {
                        // 适合重试的错误
                        const errObj = await response.json().catch(() => ({}));
                        lastError = new Error(errObj.error?.message || `HTTP ${response.status}`);
                        if (attempt < attempts - 1) {
                            await new Promise(res => setTimeout(res, delay));
                            delay *= 2;
                            continue;
                        }
                        throw lastError;
                    }
                    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
                    const msg = error.error?.message || `HTTP ${response.status}: ${response.statusText}`;

                    // 若 /responses 路径无效，回退到 chat/completions
                    if (this.shouldFallbackToCompletions(response.status, msg, useResponsesApi, fallbackTried)) {
                        useResponsesApi = false;
                        fallbackTried = true;
                        attempt--;
                        continue;
                    }

                    throw new Error(msg);
                }

                const data = await response.json();
                return this.extractResponseText(data, useResponsesApi);
            } catch (error) {
                clearTimeout(timer);
                const isAbort = error?.name === 'AbortError';
                const isNetwork = error?.message?.includes('fetch failed');
                if ((isAbort || isNetwork) && attempt < attempts - 1) {
                    lastError = error;
                    await new Promise(res => setTimeout(res, delay));
                    delay *= 2;
                    continue;
                }
                throw lastError || error;
            }
        }

        throw lastError || new Error('未知错误');
    }

    /**
     * 获取电路转换 Prompt (从文件或内嵌)
     */
    async getCircuitConversionPrompt() {
        if (this.cachedPrompt) return this.cachedPrompt;

        // 优先读取本地的提示文件，便于更新
        try {
            const resp = await fetch('电路图转JSON-Prompt.md');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = await resp.text();
            this.cachedPrompt = text;
            return text;
        } catch (err) {
            console.warn('加载电路图转JSON提示失败，使用内置后备。', err);
        }

        // 后备内置提示（精简版）
        const fallback = `请将电路图转换为规范 JSON：

## 重要规则：
1. 识别类型：PowerSource, Resistor, Rheostat(3端), Capacitor, Bulb, Switch, Ammeter, Voltmeter, Motor
2. 生成矩形/正交布局：x 递增表示从左到右，y 递增表示从上到下；rotation 0=水平，90=竖直，电源推荐 270（正极在上）
3. 每个元件必须有 label（E1/R1/R2/A1/V1 等），并填写合理属性（voltage/resistance/position 等）
4. wires 必须使用 v2 端点坐标格式：{a:{x,y},b:{x,y}}，可选端子绑定 {aRef:{componentId,terminalIndex},bRef:{...}}
5. 端子约定：电源 0=负极 1=正极；电阻/电容 0=左或上端 1=右或下端；滑变 0=a 1=b 2=滑片

6. rotation 只能是 0/90/180/270；坐标可取整数

输出仅 JSON 代码块（\`\`\`json ...\`\`\`）。`;

        this.cachedPrompt = fallback;
        return fallback;
    }

    /**
     * 是否使用 /responses API（例如 gpt-5 系列）
     */
    shouldUseResponsesApi(model) {
        const endpoint = this.config.apiEndpoint || '';
        // 用户显式指定 chat/completions 时，不启用 /responses
        if (endpoint.includes('/chat/completions')) return false;
        if (endpoint.includes('/responses')) return true;
        // 已知不支持 /responses 的兼容端点（如 oaipro）
        const host = this.safeParseHost(endpoint);
        if (host && /oaipro\.com$/i.test(host)) return false;
        return /^gpt-5/i.test(model);
    }

    safeParseHost(endpoint) {
        try {
            const url = new URL(endpoint.startsWith('http') ? endpoint : `https://${endpoint}`);
            return url.host;
        } catch (_) {
            return '';
        }
    }

    /**
     * 构建请求体，兼容 chat/completions 和 responses
     */
    buildRequestBody(messages, model, maxTokens, useResponsesApi) {
        const tokenLimit = maxTokens || this.config.maxTokens;
        const temperature = this.getTemperatureForModel(model);
        const requestBody = { model };
        if (temperature !== null && temperature !== undefined) {
            requestBody.temperature = temperature;
        }

        if (useResponsesApi) {
            requestBody.input = messages;
            if (tokenLimit) requestBody.max_output_tokens = tokenLimit;

            // 某些 responses 模型在多模态时需要声明
            if (this.containsVisionPayload(messages)) {
                requestBody.modalities = ['text', 'vision'];
            }
        } else {
            requestBody.messages = messages;
            if (tokenLimit) {
                if (this.requiresMaxCompletionTokens(model)) {
                    requestBody.max_completion_tokens = tokenLimit;
                } else {
                    requestBody.max_tokens = tokenLimit;
                }
            }
        }

        return requestBody;
    }

    /**
     * 根据模型类型选择合适的端点
     */
    resolveApiEndpoint(useResponsesApi) {
        const endpoint = this.normalizeEndpoint(this.config.apiEndpoint);
        const target = useResponsesApi ? 'responses' : 'chat/completions';

        // 已经指定了具体 API 路径时，保持原样（兼容各厂商）
        if (/(chat\/completions|responses)$/.test(endpoint)) {
            return endpoint;
        }

        // 已包含 /v1 或 /compatible-mode/v1 等路径，避免重复追加
        if (/\/v1(\/|$)/.test(endpoint)) {
            const base = endpoint.replace(/\/v1(\/.*)?$/, '/v1/');
            return base + target;
        }

        // 以 /v1 结尾的场景
        if (endpoint.endsWith('/v1')) {
            return `${endpoint}/${target}`;
        }

        // 其余情况按 OpenAI 风格补全
        const normalized = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
        return `${normalized}/v1/${target}`;
    }

    /**
     * 提取响应文本，兼容两种 API 格式
     */
    extractResponseText(data, preferResponsesFormat = false) {
        if (!data) throw new Error('响应为空');

        // responses API 常见字段
        if (typeof data.output_text === 'string') return data.output_text;
        if (typeof data.response?.output_text === 'string') return data.response.output_text;

        // responses API - outputs 数组
        const output = data.output || data.outputs || data.response?.output || data.response?.outputs;
        if (Array.isArray(output) && output.length) {
            const text = this.extractTextFromContent(output[0].content || output[0].message?.content);
            if (text) return text;
        }

        // chat/completions 或兼容 responses 回落
        const choiceContent = data?.choices?.[0]?.message?.content;
        const text = this.extractTextFromContent(choiceContent);
        if (text) return text;

        throw new Error('响应中未找到文本内容');
    }

    /**
     * 判断消息是否包含视觉输入
     */
    containsVisionPayload(messages) {
        if (!Array.isArray(messages)) return false;
        return messages.some(msg => Array.isArray(msg.content) && msg.content.some(
            item => item?.type === 'image_url' || item?.type === 'input_image'
        ));
    }

    /**
     * 部分新模型在 chat/completions 端点要求使用 max_completion_tokens
     */
    requiresMaxCompletionTokens(model) {
        const id = model?.toLowerCase?.() || '';
        return /^gpt-(4\\.1|5)/.test(id) || id.includes('gpt-5');
    }

    /**
     * 获取温度参数，部分模型必须使用默认温度，不支持自定义
     */
    getTemperatureForModel(model) {
        const id = model?.toLowerCase?.() || '';
        // gpt-5 系列（含 nano/5.1）在部分兼容端点仅接受默认温度，直接省略
        if (/^gpt-5/.test(id)) return null;
        if (/qwen/i.test(id) || /dashscope/i.test(this.config.apiEndpoint || '')) return null;
        return 0.7;
    }

    /**
     * 确保端点为绝对 URL；若用户仅输入域名或 /v1/...，补全为 https://api.openai.com
     */
    normalizeEndpoint(endpoint) {
        const raw = (endpoint || '').trim();
        if (!raw) return 'https://api.openai.com/v1/chat/completions';

        // 绝对地址
        try {
            const u = new URL(raw);
            return u.toString().replace(/\/+$/, '');
        } catch (_) {
            // 不是完整 URL，继续处理
        }

        // 以 / 开头，补上默认 host
        const normalized = raw.startsWith('/') ? `https://api.openai.com${raw}` : `https://${raw}`;
        try {
            const u2 = new URL(normalized);
            return u2.toString().replace(/\/+$/, '');
        } catch (_) {
            return 'https://api.openai.com/v1/chat/completions';
        }
    }

    /**
     * 从 content 中提取文本（兼容字符串或数组结构）
     */
    extractTextFromContent(content) {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (!Array.isArray(content)) return '';
        const parts = content
            .map(part => {
                if (typeof part === 'string') return part;
                if (typeof part?.text === 'string') return part.text;
                if (part?.type && typeof part?.text === 'string') return part.text;
                return '';
            })
            .filter(Boolean);
        return parts.join('\n').trim();
    }

    /**
     * 当 /responses 不可用时是否回退到 chat/completions
     */
    shouldFallbackToCompletions(status, message, useResponsesApi, fallbackTried) {
        if (!useResponsesApi || fallbackTried) return false;
        if (status === 404 || status === 405) return true;
        if (status === 400) {
            const lower = (message || '').toLowerCase();
            return lower.includes('invalid url') || lower.includes('not found') || lower.includes('/responses');
        }
        return false;
    }
}
