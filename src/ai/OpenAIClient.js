/**
 * OpenAIClient.js - OpenAI API 客户端
 * 支持 OpenAI 兼容的 API 端点
 */

export class OpenAIClient {
    constructor() {
        this.config = this.loadConfig();
    }

    /**
     * 从 localStorage 加载配置
     */
    loadConfig() {
        const defaultConfig = {
            apiEndpoint: 'https://api.openai.com/v1/chat/completions',
            apiKey: '',
            visionModel: 'gpt-4-vision-preview',
            textModel: 'gpt-4',
            maxTokens: 2000
        };

        try {
            const saved = localStorage.getItem('ai_config');
            return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
        } catch (e) {
            console.error('Failed to load AI config:', e);
            return defaultConfig;
        }
    }

    /**
     * 保存配置到 localStorage
     */
    saveConfig(config) {
        this.config = { ...this.config, ...config };
        localStorage.setItem('ai_config', JSON.stringify(this.config));
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

        const systemPrompt = `你是一位经验丰富的高中物理老师，专门解释电路问题。

请用以下方式回答学生的问题：
1. 使用高中生能理解的语言
2. 引用欧姆定律、串并联电路规律等基础知识
3. 结合电路中的具体数值进行计算说明
4. 分步骤解释，每步都要有物理依据
5. 用简洁清晰的中文回答，避免过于专业的术语

当前电路状态：
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
     * 调用 OpenAI API
     */
    async callAPI(messages, model, maxTokens = null) {
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
        
        const response = await fetch(this.config.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * 获取电路转换 Prompt (从文件或内嵌)
     */
    async getCircuitConversionPrompt() {
        return `请仔细分析图片中的电路图，将其转换为精确的JSON格式。

## 重要规则：
1. **理解电路拓扑**: 识别串联、并联关系，不要仅仅复制视觉位置
2. **简化布局**: 生成的电路应该是规整的矩形布局，不需要复刻原图的复杂路径
3. **准确识别元器件**: 电源(+/-)、电阻(矩形)、滑动变阻器(P标记)、开关(S)、电流表(A)、电压表(V)
4. **标签命名**: 所有元器件必须有标签(如E1, R1, R2, P, A, V, S1)
5. **参数设置**: 根据常识设置合理的电压、电阻值
6. **规整坐标**: 使用简洁的矩形布局，水平/垂直对齐

## 电路分析步骤：
1. 找到电源的正负极
2. 从正极出发，跟踪电流路径
3. 识别串联部分(电流依次经过)
4. 识别并联部分(电流分流)
5. 绘制简化的矩形电路图

## 标准布局模板(推荐)：

对于串联电路:
  电源+ --- 元件1 --- 元件2 --- 元件3
     |                              |
     +------------------------------+
  
坐标建议:
  电源: (150, 300), rotation=270
  顶部元件: y=150, x依次递增(300, 450, 600...)
  底部回路: y=450

对于并联电路:
  电源+ --- 分支点
             ├--- 支路1 ---+
             ├--- 支路2 ---+ 汇合点
             └--- 支路3 ---+
     |                      |
     +----------------------+

坐标建议:
  电源: (150, 300)
  各支路y坐标: 150, 250, 350
  汇合点x: 700

## 输出JSON格式：
\`\`\`json
{
  "meta": {
    "version": "1.0",
    "timestamp": ${Date.now()},
    "name": "电路设计",
    "description": "从电路图转换而来"
  },
  "components": [
    {
      "id": "PowerSource_1",
      "type": "PowerSource",
      "label": "E1",
      "x": 200,
      "y": 200,
      "rotation": 270,
      "properties": {
        "voltage": 12,
        "internalResistance": 0.5
      }
    },
    {
      "id": "Resistor_R1",
      "type": "Resistor",
      "label": "R1",
      "x": 400,
      "y": 200,
      "rotation": 0,
      "properties": {
        "resistance": 10
      }
    },
    {
      "id": "Ammeter_A1",
      "type": "Ammeter",
      "label": "A1",
      "x": 300,
      "y": 200,
      "rotation": 0,
      "properties": {
        "resistance": 0,
        "range": 3
      }
    },
    {
      "id": "Switch_S1",
      "type": "Switch",
      "label": "S1",
      "x": 500,
      "y": 200,
      "rotation": 0,
      "properties": {
        "closed": true
      }
    }
  ],
  "wires": [
    {
      "id": "wire_1",
      "start": { "componentId": "PowerSource_1", "terminalIndex": 1 },
      "end": { "componentId": "Ammeter_A1", "terminalIndex": 0 },
      "controlPoints": []
    },
    {
      "id": "wire_2",
      "start": { "componentId": "Ammeter_A1", "terminalIndex": 1 },
      "end": { "componentId": "Resistor_R1", "terminalIndex": 0 },
      "controlPoints": []
    },
    {
      "id": "wire_3",
      "start": { "componentId": "Resistor_R1", "terminalIndex": 1 },
      "end": { "componentId": "Switch_S1", "terminalIndex": 0 },
      "controlPoints": []
    },
    {
      "id": "wire_4",
      "start": { "componentId": "Switch_S1", "terminalIndex": 1 },
      "end": { "componentId": "PowerSource_1", "terminalIndex": 0 },
      "controlPoints": []
    }
  ]
}
\`\`\`

## 元器件类型详解：

### 1. PowerSource (电源)
- **terminalIndex**: 0=负极, 1=正极
- **rotation**: 电流从正极流出，通常设置270度（正极在上）或90度（正极在下）
- **properties**: 
  - voltage: 电动势(V)，典型值 1.5V, 3V, 6V, 9V, 12V
  - internalResistance: 内阻(Ω)，通常 0.5-2Ω，理想电源设为0.1

### 2. Resistor (定值电阻)
- **terminalIndex**: 0=左端, 1=右端
- **rotation**: 0度（水平）、90度（竖直）
- **properties**:
  - resistance: 电阻值(Ω)，常见 5Ω, 10Ω, 20Ω, 50Ω, 100Ω

### 3. Rheostat (滑动变阻器)
- **terminalIndex**: 0=左端, 1=右端, 2=滑片
- **rotation**: 通常0度
- **properties**:
  - maxResistance: 最大阻值(Ω)，如 20Ω, 50Ω
  - minResistance: 最小阻值(Ω)，通常0Ω
  - position: 滑片位置(0-1)，0.5表示中间
  - connectionMode: 连接方式，"left-slider"(左端和滑片) 或 "right-slider"(右端和滑片)

### 4. Bulb (灯泡)
- **terminalIndex**: 0=左端, 1=右端
- **rotation**: 0度或90度
- **properties**:
  - resistance: 灯丝电阻(Ω)，典型 5-50Ω
  - ratedPower: 额定功率(W)，如 2.5W, 5W, 10W

### 5. Capacitor (电容)
- **terminalIndex**: 0=负极, 1=正极
- **rotation**: 0度或90度
- **properties**:
  - capacitance: 电容值(F)，常用 0.001F, 0.01F, 0.1F

### 6. Motor (电动机)
- **terminalIndex**: 0=左端, 1=右端
- **rotation**: 0度
- **properties**:
  - resistance: 电枢电阻(Ω)，典型 5-10Ω
  - torqueConstant: 转矩常数，默认0.1
  - emfConstant: 反电动势常数，默认0.1

### 7. Switch (开关)
- **terminalIndex**: 0=左端, 1=右端
- **rotation**: 0度或90度
- **properties**:
  - closed: true(闭合) 或 false(断开)

### 8. Ammeter (电流表)
- **terminalIndex**: 0=负接线柱, 1=正接线柱
- **rotation**: 0度或90度
- **properties**:
  - resistance: 内阻(Ω)，理想电流表设为0
  - range: 量程(A)，如 0.6A, 3A

### 9. Voltmeter (电压表)
- **terminalIndex**: 0=负接线柱, 1=正接线柱
- **rotation**: 0度或90度
- **properties**:
  - resistance: 内阻(Ω)，理想电压表设为Infinity或极大值如1e12
  - range: 量程(V)，如 3V, 15V

## 坐标布局建议：
- **画布中心**: 约(400, 300)
- **水平间距**: 元器件之间间隔100-150像素
- **竖直间距**: 上下分支间隔100-150像素
- **串联电路**: 元器件沿同一水平线或竖直线排列
- **并联电路**: 分支在不同的y坐标

## 导线连接规则：
- **terminalIndex**: 必须正确对应元器件的端子编号
- **电源**: 负极(0)通常作为参考地，正极(1)输出电流
- **电流表**: 串联在电路中，电流从负接线柱(0)流入，正接线柱(1)流出
- **电压表**: 并联在待测元件两端
- **闭合回路**: 确保电路形成完整的闭合回路

## 输出要求：
1. 只输出JSON代码块，使用 \`\`\`json ... \`\`\` 包裹
2. 确保JSON格式正确，可以直接被JavaScript解析
3. 所有字符串使用双引号
4. 数值不加引号
5. 布尔值使用 true/false
6. 坐标值必须是整数
7. rotation 只能是 0, 90, 180, 270

现在请分析图片中的电路图并生成JSON：`;
    }
}
