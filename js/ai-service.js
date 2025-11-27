class AIService {
    constructor() {
        this.config = {
            baseUrl: '',
            modelName: '',
            apiKey: ''
        };
    }

    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config
        };
    }

    isReady() {
        return Boolean(this.config.baseUrl && this.config.modelName && this.config.apiKey);
    }

    buildEndpoint() {
        if (!this.config.baseUrl) {
            throw new Error('请先配置 Base URL');
        }
        let endpoint = this.config.baseUrl.trim();
        endpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
        if (!/chat\/completions$/.test(endpoint)) {
            endpoint = `${endpoint}/chat/completions`;
        }
        return endpoint;
    }

    async sendChat({ systemPrompt, userPrompt, temperature = 0.7, responseFormat }) {
        if (!this.isReady()) {
            throw new Error('请先完善 AI 配置');
        }

        const endpoint = this.buildEndpoint();
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };

        const payload = {
            model: this.config.modelName,
            temperature,
            messages: [
                { role: 'system', content: systemPrompt || '你是一名拥有丰富经验的中文小说策划与写作助手。' },
                { role: 'user', content: userPrompt }
            ]
        };

        if (responseFormat) {
            payload.response_format = responseFormat;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            const message = data?.error?.message || 'AI 服务请求失败';
            throw new Error(message);
        }

        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('AI 没有返回内容');
        }

        return content.trim();
    }
}

window.aiService = new AIService();
