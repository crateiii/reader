const { createApp } = Vue;

createApp({
    data() {
        return {
            currentStep: 'config',
            config: {
                baseUrl: '',
                modelName: '',
                apiKey: ''
            },
            projectName: '',
            novelInfo: {
                title: '',
                description: '',
                reference: '',
                style: '',
                chapterCount: 0
            },
            outline: '',
            detailedOutline: '',
            chapters: [],
            currentChapterIndex: 0,
            chapterSubStep: 'summary',
            isLoading: false,
            completedSteps: [],
            toast: {
                show: false,
                message: '',
                type: 'info'
            },
            novelMetadata: {
                characters: {},
                plotPoints: [],
                foreshadowing: []
            },
            steps: [
                { id: 'novel-info', name: '基本信息', icon: 'fas fa-pencil-alt' },
                { id: 'outline', name: '大纲', icon: 'fas fa-list-ol' },
                { id: 'detailed-outline', name: '细纲', icon: 'fas fa-stream' },
                { id: 'chapter-creation', name: '章节创作', icon: 'fas fa-feather' }
            ],
            storageMode: 'localStorage',
            lastSaved: null,
            metadataNotes: '',
            aggregatedMetadata: {
                protagonist: null,
                characters: [],
                foreshadowing: []
            }
        };
    },
    computed: {
        isConfigValid() {
            return this.config.baseUrl && this.config.modelName && this.config.apiKey;
        },
        currentChapter() {
            return this.chapters[this.currentChapterIndex] || null;
        },
        allChaptersCompleted() {
            return this.chapters.length > 0 && 
                   this.chapters.every(ch => ch.status === 'completed');
        },
        completedChapters() {
            return this.chapters.filter(ch => ch.status === 'completed').length;
        },
        stepLabel() {
            const step = this.steps.find(s => s.id === this.currentStep);
            return step ? step.name : '未知';
        },
        fileStorageSupported() {
            return window.storageService.supportsFileAPI();
        }
    },
    watch: {
        novelInfo: {
            handler() {
                this.autoSave();
            },
            deep: true
        },
        outline() {
            this.autoSave();
        },
        detailedOutline() {
            this.autoSave();
        },
        chapters: {
            handler() {
                this.autoSave();
                this.updateAggregatedMetadata();
            },
            deep: true
        },
        metadataNotes() {
            this.autoSave();
        }
    },
    mounted() {
        this.loadConfig();
        this.loadProject();
        
        setInterval(() => {
            if (this.currentStep !== 'config') {
                this.autoSave();
            }
        }, 30000);
    },
    methods: {
        scrollToWizard() {
            const wizard = document.getElementById('wizard');
            if (wizard) {
                wizard.scrollIntoView({ behavior: 'smooth' });
            }
        },
        
        loadConfig() {
            const savedConfig = localStorage.getItem('ai-novel-config');
            if (savedConfig) {
                try {
                    this.config = JSON.parse(savedConfig);
                    window.aiService.updateConfig(this.config);
                } catch (error) {
                    console.error('Failed to load config:', error);
                }
            }
        },
        
        saveConfig() {
            localStorage.setItem('ai-novel-config', JSON.stringify(this.config));
            window.aiService.updateConfig(this.config);
            this.currentStep = 'novel-info';
            this.showToast('配置已保存', 'success');
        },
        
        async loadProject() {
            const project = await window.storageService.loadProject();
            if (project) {
                this.projectName = project.projectName || '';
                this.novelInfo = project.novelInfo || this.novelInfo;
                this.outline = project.outline || '';
                this.detailedOutline = project.detailedOutline || '';
                this.chapters = project.chapters || [];
                this.completedSteps = project.completedSteps || [];
                this.novelMetadata = project.novelMetadata || this.novelMetadata;
                this.metadataNotes = project.metadataNotes || '';
                this.lastSaved = project.savedAt || null;
                
                if (project.currentStep && project.currentStep !== 'config') {
                    this.currentStep = project.currentStep;
                }
                
                this.updateAggregatedMetadata();
            }
        },
        
        autoSave() {
            if (this.currentStep === 'config') return;
            
            const projectData = this.getProjectData();
            window.storageService.autoSave(projectData);
            this.lastSaved = new Date().toISOString();
        },
        
        manualSave() {
            const projectData = this.getProjectData();
            const result = window.storageService.autoSave(projectData);
            this.lastSaved = new Date().toISOString();
            if (result) {
                this.showToast('保存成功', 'success');
            } else {
                this.showToast('保存失败', 'error');
            }
        },
        
        async enableFileStorage() {
            if (this.storageMode === 'file') {
                this.showToast('文件存储已启用', 'info');
                return;
            }
            
            const projectData = this.getProjectData();
            const result = await window.storageService.saveProject(projectData);
            
            if (result.success) {
                if (result.method === 'file') {
                    this.storageMode = 'file';
                    this.showToast('已启用文件存储', 'success');
                }
            } else {
                this.showToast('文件存储失败', 'error');
            }
        },
        
        getProjectData() {
            return {
                projectName: this.novelInfo.title || '未命名项目',
                currentStep: this.currentStep,
                novelInfo: this.novelInfo,
                outline: this.outline,
                detailedOutline: this.detailedOutline,
                chapters: this.chapters,
                completedSteps: this.completedSteps,
                novelMetadata: this.novelMetadata,
                metadataNotes: this.metadataNotes,
                savedAt: new Date().toISOString()
            };
        },
        
        async exportProject() {
            const projectData = this.getProjectData();
            window.storageService.exportAsJSON(
                projectData, 
                `${this.novelInfo.title || '小说项目'}-${Date.now()}.json`
            );
            this.showToast('项目已导出', 'success');
        },
        
        async importProject() {
            try {
                const projectData = await window.storageService.loadFromFile();
                if (projectData) {
                    this.projectName = projectData.projectName || '';
                    this.novelInfo = projectData.novelInfo || this.novelInfo;
                    this.outline = projectData.outline || '';
                    this.detailedOutline = projectData.detailedOutline || '';
                    this.chapters = projectData.chapters || [];
                    this.completedSteps = projectData.completedSteps || [];
                    this.novelMetadata = projectData.novelMetadata || this.novelMetadata;
                    this.metadataNotes = projectData.metadataNotes || '';
                    
                    if (projectData.currentStep && projectData.currentStep !== 'config') {
                        this.currentStep = projectData.currentStep;
                    }
                    
                    this.updateAggregatedMetadata();
                    this.showToast('项目已导入', 'success');
                }
            } catch (error) {
                this.showToast('导入失败: ' + error.message, 'error');
            }
        },
        
        resetProject() {
            if (confirm('确定要重置项目吗？所有数据将被清除。')) {
                window.storageService.clearProject();
                this.currentStep = 'novel-info';
                this.projectName = '';
                this.novelInfo = { title: '', description: '', reference: '', style: '', chapterCount: 0 };
                this.outline = '';
                this.detailedOutline = '';
                this.chapters = [];
                this.completedSteps = [];
                this.novelMetadata = { characters: {}, plotPoints: [], foreshadowing: [] };
                this.metadataNotes = '';
                this.aggregatedMetadata = { protagonist: null, characters: [], foreshadowing: [] };
                this.showToast('项目已重置', 'info');
            }
        },
        
        isStepCompleted(stepId) {
            return this.completedSteps.includes(stepId);
        },
        
        markStepCompleted(stepId) {
            if (!this.completedSteps.includes(stepId)) {
                this.completedSteps.push(stepId);
            }
        },
        
        async generateOutline() {
            this.isLoading = true;
            try {
                const systemPrompt = `你是一位经验丰富的小说策划师和编剧，擅长构建引人入胜的故事架构。
你的任务是根据用户提供的小说创意，创作一份详细而有吸引力的小说大纲。

大纲应该包括：
1. 故事背景设定
2. 主要角色介绍（主角、配角）
3. 核心冲突和矛盾
4. 主要情节线（起承转合）
5. 预期结局方向

请确保大纲：
- 逻辑清晰，结构完整
- 有足够的戏剧冲突
- 角色设定丰富立体
- 情节发展合理有趣`;

                let userPrompt = `请为以下小说创意生成一份完整的大纲：\n\n${this.novelInfo.description}`;
                
                if (this.novelInfo.reference) {
                    userPrompt += `\n\n参考内容：\n${this.novelInfo.reference}`;
                }
                
                if (this.novelInfo.style) {
                    userPrompt += `\n\n文风要求：${this.novelInfo.style}`;
                }

                this.outline = await window.aiService.sendChat({
                    systemPrompt,
                    userPrompt,
                    temperature: 0.8
                });

                this.currentStep = 'outline';
                this.markStepCompleted('novel-info');
                this.showToast('大纲生成成功', 'success');
            } catch (error) {
                this.showToast('生成失败: ' + error.message, 'error');
            } finally {
                this.isLoading = false;
            }
        },
        
        async regenerateOutline() {
            await this.generateOutline();
        },
        
        async confirmOutline() {
            if (!this.outline) {
                this.showToast('请先生成大纲', 'error');
                return;
            }
            
            this.isLoading = true;
            try {
                const systemPrompt = `你是一位小说创作大师，擅长将概括性的大纲扩展为详细的细纲。
细纲应该包括：
1. 将整体故事分解为具体的章节结构
2. 每个主要情节点的详细展开
3. 角色成长和转变的具体时间点
4. 重要场景的详细描述
5. 伏笔的埋设和回收计划

请确保细纲：
- 章节划分合理（根据用户要求或默认15-30章）
- 每章节有明确的情节目标
- 节奏把握得当
- 伏笔设置巧妙`;

                const userPrompt = `基于以下大纲，生成详细的细纲：

原始创意：
${this.novelInfo.description}

大纲：
${this.outline}

${this.novelInfo.chapterCount ? `目标章节数：${this.novelInfo.chapterCount}章` : ''}
${this.novelInfo.style ? `文风要求：${this.novelInfo.style}` : ''}`;

                this.detailedOutline = await window.aiService.sendChat({
                    systemPrompt,
                    userPrompt,
                    temperature: 0.7
                });

                this.currentStep = 'detailed-outline';
                this.markStepCompleted('outline');
                this.showToast('细纲生成成功', 'success');
            } catch (error) {
                this.showToast('生成失败: ' + error.message, 'error');
            } finally {
                this.isLoading = false;
            }
        },
        
        async regenerateDetailedOutline() {
            await this.confirmOutline();
        },
        
        async confirmDetailedOutline() {
            if (!this.detailedOutline) {
                this.showToast('请先生成细纲', 'error');
                return;
            }
            
            this.isLoading = true;
            try {
                const systemPrompt = `你是一位小说创作专家。根据细纲，提取出章节结构。
请以JSON格式返回章节列表，每个章节包含：
- title: 章节标题
- summary: 章节摘要（包括主要情节、角色、场景）

格式示例：
[
  {
    "title": "第一章标题",
    "summary": "章节摘要内容..."
  }
]`;

                const userPrompt = `从以下细纲中提取章节信息：\n\n${this.detailedOutline}`;

                const response = await window.aiService.sendChat({
                    systemPrompt,
                    userPrompt,
                    temperature: 0.3
                });

                let chaptersData;
                try {
                    chaptersData = JSON.parse(response);
                } catch {
                    const lines = this.detailedOutline.split('\n');
                    chaptersData = [];
                    let currentChapter = null;
                    
                    lines.forEach(line => {
                        const chapterMatch = line.match(/第[一二三四五六七八九十\d]+章[：:](.*)/);
                        if (chapterMatch) {
                            if (currentChapter) {
                                chaptersData.push(currentChapter);
                            }
                            currentChapter = {
                                title: chapterMatch[1].trim(),
                                summary: ''
                            };
                        } else if (currentChapter && line.trim()) {
                            currentChapter.summary += line.trim() + '\n';
                        }
                    });
                    
                    if (currentChapter) {
                        chaptersData.push(currentChapter);
                    }
                    
                    if (chaptersData.length === 0) {
                        const count = this.novelInfo.chapterCount || 10;
                        for (let i = 0; i < count; i++) {
                            chaptersData.push({
                                title: `第${i + 1}章`,
                                summary: ''
                            });
                        }
                    }
                }

                this.chapters = chaptersData.map((ch, idx) => ({
                    id: Date.now() + idx,
                    title: ch.title || '未命名',
                    summary: ch.summary || '',
                    content: '',
                    metadata: {
                        characters: '',
                        plot: '',
                        foreshadowing: '',
                        structured: null
                    },
                    status: 'planning'
                }));

                this.currentChapterIndex = 0;
                this.chapterSubStep = 'summary';
                this.currentStep = 'chapter-creation';
                this.markStepCompleted('detailed-outline');
                this.showToast('章节摘要已生成', 'success');
            } catch (error) {
                console.error('Error:', error);
                this.showToast('生成失败: ' + error.message, 'error');
            } finally {
                this.isLoading = false;
            }
        },
        
        generateChapterSummaries() {
            this.confirmDetailedOutline();
        },
        
        addChapterManually() {
            const newChapter = {
                id: Date.now(),
                title: `第${this.chapters.length + 1}章`,
                summary: '',
                content: '',
                metadata: {
                    characters: '',
                    plot: '',
                    foreshadowing: '',
                    structured: null
                },
                status: 'planning'
            };
            this.chapters.push(newChapter);
            this.currentChapterIndex = this.chapters.length - 1;
            this.chapterSubStep = 'summary';
            this.showToast('新章节已添加', 'success');
        },
        
        selectChapter(index) {
            this.currentChapterIndex = index;
            
            const chapter = this.chapters[index];
            if (chapter.status === 'completed') {
                this.chapterSubStep = 'summary';
            } else if (chapter.content) {
                this.chapterSubStep = 'metadata';
            } else if (chapter.summary) {
                this.chapterSubStep = 'summary';
            } else {
                this.chapterSubStep = 'summary';
            }
        },
        
        async generateChapterContent() {
            this.isLoading = true;
            try {
                const chapter = this.currentChapter;
                const previousChapters = this.chapters.slice(0, this.currentChapterIndex);
                
                let contextInfo = '';
                if (previousChapters.length > 0) {
                    const recentChapters = previousChapters.slice(-2);
                    contextInfo = '\n\n前文回顾：\n';
                    recentChapters.forEach((ch, idx) => {
                        const chapterNum = this.currentChapterIndex - recentChapters.length + idx + 1;
                        contextInfo += `第${chapterNum}章 ${ch.title}：${ch.metadata.plot || ch.summary}\n`;
                    });
                }

                const systemPrompt = `你是一位优秀的小说作家，擅长创作引人入胜的故事内容。

创作要求：
1. 文笔流畅，描写生动
2. 对话自然，符合角色性格
3. 情节推进合理
4. 注重细节描写和氛围营造
5. 保持前后文的连贯性
6. 章节长度适中（2000-5000字）

${this.novelInfo.style ? `文风要求：${this.novelInfo.style}` : ''}`;

                const userPrompt = `请根据以下信息创作章节内容：

小说背景：
${this.novelInfo.description}

大纲：
${this.outline}

${contextInfo}

当前章节摘要：
第${this.currentChapterIndex + 1}章 ${chapter.title}
${chapter.summary}

请直接开始创作，不要添加章节标题。`;

                chapter.content = await window.aiService.sendChat({
                    systemPrompt,
                    userPrompt,
                    temperature: 0.85
                });

                chapter.status = 'drafting';
                this.chapterSubStep = 'content';
                this.showToast('章节内容生成成功', 'success');
            } catch (error) {
                this.showToast('生成失败: ' + error.message, 'error');
            } finally {
                this.isLoading = false;
            }
        },
        
        async regenerateChapterContent() {
            if (confirm('确定要重新生成章节内容吗？当前内容将被覆盖。')) {
                await this.generateChapterContent();
            }
        },
        
        async updateMetadata() {
            this.isLoading = true;
            try {
                const chapter = this.currentChapter;

                const systemPrompt = `你是一位小说分析专家，擅长提取和分析小说中的关键信息。
请分析章节内容，提取以下信息：
1. 角色信息：本章出现的重要角色及其特征、能力、状态的变化
2. 情节发展：本章的主要情节和剧情推进
3. 伏笔与线索：本章埋下的伏笔或重要线索

请以结构化的方式返回，清晰明了。`;

                const userPrompt = `请分析以下章节内容：

第${this.currentChapterIndex + 1}章 ${chapter.title}

${chapter.content}`;

                const metadataText = await window.aiService.sendChat({
                    systemPrompt,
                    userPrompt,
                    temperature: 0.3
                });

                const sections = metadataText.split(/\n(?=角色信息|情节发展|伏笔与线索)/);
                
                sections.forEach(section => {
                    if (section.includes('角色信息')) {
                        chapter.metadata.characters = section.replace(/.*?角色信息[：:]\s*/s, '').trim();
                    } else if (section.includes('情节发展')) {
                        chapter.metadata.plot = section.replace(/.*?情节发展[：:]\s*/s, '').trim();
                    } else if (section.includes('伏笔')) {
                        chapter.metadata.foreshadowing = section.replace(/.*?伏笔[^：:]*[：:]\s*/s, '').trim();
                    }
                });

                if (!chapter.metadata.characters && !chapter.metadata.plot && !chapter.metadata.foreshadowing) {
                    chapter.metadata.characters = metadataText;
                }

                this.chapterSubStep = 'metadata';
                this.updateAggregatedMetadata();
                this.showToast('元数据生成成功', 'success');
            } catch (error) {
                this.showToast('生成失败: ' + error.message, 'error');
            } finally {
                this.isLoading = false;
            }
        },
        
        confirmChapter() {
            this.currentChapter.status = 'completed';
            this.showToast(`第${this.currentChapterIndex + 1}章已完成`, 'success');
            
            if (this.currentChapterIndex < this.chapters.length - 1) {
                this.currentChapterIndex++;
                this.chapterSubStep = 'summary';
            } else {
                this.updateAggregatedMetadata();
            }
        },
        
        updateAggregatedMetadata() {
            const characters = [];
            const foreshadowing = [];
            
            this.chapters.forEach(ch => {
                if (ch.metadata.characters) {
                    const lines = ch.metadata.characters.split('\n');
                    lines.forEach(line => {
                        if (line.trim()) {
                            const match = line.match(/([^：:]+)[：:]\s*(.+)/);
                            if (match) {
                                const existing = characters.find(c => c.name === match[1].trim());
                                if (!existing) {
                                    characters.push({
                                        name: match[1].trim(),
                                        role: match[2].trim().substring(0, 50),
                                        status: ''
                                    });
                                }
                            }
                        }
                    });
                }
                
                if (ch.metadata.foreshadowing) {
                    const lines = ch.metadata.foreshadowing.split('\n');
                    lines.forEach(line => {
                        const cleaned = line.trim().replace(/^[•\-*]\s*/, '');
                        if (cleaned && !foreshadowing.includes(cleaned)) {
                            foreshadowing.push(cleaned);
                        }
                    });
                }
            });
            
            this.aggregatedMetadata = {
                protagonist: characters.length > 0 ? characters[0] : null,
                characters: characters.slice(0, 10),
                foreshadowing: foreshadowing.slice(0, 10)
            };
        },
        
        exportFinalNovel() {
            const projectData = this.getProjectData();
            window.storageService.exportAsText(
                projectData,
                `${this.novelInfo.title || '小说'}.txt`
            );
            this.showToast('小说已导出为TXT文件', 'success');
        },
        
        formatTimestamp(isoString) {
            if (!isoString) return '尚未保存';
            const date = new Date(isoString);
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) {
                return '刚刚';
            } else if (diff < 3600000) {
                return `${Math.floor(diff / 60000)}分钟前`;
            } else if (diff < 86400000) {
                return `${Math.floor(diff / 3600000)}小时前`;
            } else {
                return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            }
        },
        
        showToast(message, type = 'info') {
            this.toast.message = message;
            this.toast.type = type;
            this.toast.show = true;
            
            setTimeout(() => {
                this.toast.show = false;
            }, 3000);
        }
    }
}).mount('#app');
