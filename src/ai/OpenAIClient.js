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

        try {
            const savedPublic = localStorage.getItem(this.PUBLIC_CONFIG_KEY);
            const sessionKey = sessionStorage.getItem(this.SESSION_KEY_KEY) || '';
            const merged = savedPublic ? { ...defaultConfig, ...JSON.parse(savedPublic) } : defaultConfig;
            return { ...merged, apiKey: sessionKey };
        } catch (e) {
            console.error('Failed to load AI config:', e);
            return defaultConfig;
        }
    }

    /**
     * 保存配置到 localStorage
     */
    saveConfig(config) {
        const { apiKey, ...rest } = config;
        this.config = { ...this.config, ...rest, apiKey: apiKey ?? this.config.apiKey };

        try {
            localStorage.setItem(this.PUBLIC_CONFIG_KEY, JSON.stringify({
                apiEndpoint: this.config.apiEndpoint,
                visionModel: this.config.visionModel,
                textModel: this.config.textModel,
                maxTokens: this.config.maxTokens,
                requestTimeout: this.config.requestTimeout,
                retryAttempts: this.config.retryAttempts,
                retryDelayMs: this.config.retryDelayMs
            }));
        } catch (e) {
            console.error('Failed to save AI public config:', e);
        }

        if (apiKey !== undefined) {
            try {
                if (apiKey) {
                    sessionStorage.setItem(this.SESSION_KEY_KEY, apiKey);
                } else {
                    sessionStorage.removeItem(this.SESSION_KEY_KEY);
                }
            } catch (e) {
                console.error('Failed to persist API key to session storage:', e);
            }
        }
    }

    clearApiKey() {
        this.config.apiKey = '';
        try {
            sessionStorage.removeItem(this.SESSION_KEY_KEY);
        } catch (e) {
            console.error('Failed to clear API key from session storage:', e);
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
                content: '你是一个专业的电路图识别助手。请根据用户上传的电路图图片，严格按照提供的格式规范输出 JSON。'
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

        const systemPrompt = `你是一位耐心的高中物理老师，采用“学习模式”与学生互动讲解电路。
要求：
- 语言简洁、贴近高中课程，不引入超纲（大学/微积分/复阻抗）内容。
- 使用欧姆定律、串并联规律、功率/能量守恒等基础知识。
- 先给出核心回答，再用 3-5 步简明推理说明；每步点出物理依据。
- 适度反问/小测验：给 1-2 个简短检查题（如“R1 电流如何变化？选 A/B”或“请代入公式算出电流约多少 A”），鼓励学生参与。
- 如需要计算，给出关键中间值，数值保留 2-3 位有效数字；明确公式出处。
- 发现题意不全时，先澄清再作答。
- 不使用过于口语化的表情/Emoji。

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

        const apiEndpoint = this.config.apiEndpoint || '';
        const base = apiEndpoint.includes('/v1/')
            ? apiEndpoint.split('/v1/')[0] + '/v1/models'
            : (apiEndpoint.endsWith('/') ? apiEndpoint + 'models' : apiEndpoint + '/models');

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

        // Build request body - some APIs use max_tokens, others use max_completion_tokens
        const requestBody = {
            model: model,
            messages: messages,
            temperature: 0.7
        };
        
        // Add token limit parameter (try newer parameter name first)
        const tokenLimit = maxTokens || this.config.maxTokens;
        if (tokenLimit) {
            // Use max_tokens for broader compatibility with third-party APIs
            requestBody.max_tokens = tokenLimit;
        }

        const attempts = Math.max(1, this.config.retryAttempts || 1);
        let delay = Math.max(200, this.config.retryDelayMs || 200);
        let lastError;

        for (let attempt = 0; attempt < attempts; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.config.requestTimeout || 20000);
            try {
                const response = await fetch(this.config.apiEndpoint, {
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
                    throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                return data.choices[0].message.content;
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
4. wires 使用 {start:{componentId,terminalIndex},end:{...},controlPoints:[]} 连接正确端子
5. 端子约定：电源 0=负极 1=正极；电阻/电容 0=左或上端 1=右或下端；滑变 0=a 1=b 2=滑片

6. rotation 只能是 0/90/180/270；坐标可取整数

输出仅 JSON 代码块（\`\`\`json ...\`\`\`）。`;

        this.cachedPrompt = fallback;
        return fallback;
    }
}
