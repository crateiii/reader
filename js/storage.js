class StorageService {
    constructor() {
        this.storageKey = 'ai-novel-creator-project';
        this.fileHandle = null;
        this.pendingWrite = Promise.resolve();
    }

    supportsFileAPI() {
        return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
    }

    async requestFileHandle(defaultName = 'ai-novel-session.json') {
        if (!this.supportsFileAPI()) {
            throw new Error('当前浏览器不支持 File System Access API');
        }

        const options = {
            suggestedName: defaultName,
            types: [
                {
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }
            ]
        };

        this.fileHandle = await window.showSaveFilePicker(options);
        return this.fileHandle;
    }

    async writeToFile(content) {
        if (!this.fileHandle) return;
        const writable = await this.fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    }

    async saveProject(data) {
        const payload = JSON.stringify(data, null, 2);

        try {
            localStorage.setItem(this.storageKey, payload);
        } catch (error) {
            console.error('无法写入浏览器缓存:', error);
        }

        if (!this.supportsFileAPI()) {
            return { success: true, method: 'localStorage' };
        }

        try {
            if (!this.fileHandle) {
                await this.requestFileHandle(`${data.projectName || 'novel-project'}.json`);
            }
            await this.writeToFile(payload);
            return { success: true, method: 'file' };
        } catch (error) {
            console.error('保存到文件失败:', error);
            this.fileHandle = null;
            return { success: false, error: error.message };
        }
    }

    async loadProject() {
        const localData = localStorage.getItem(this.storageKey);
        if (localData) {
            try {
                return JSON.parse(localData);
            } catch (error) {
                console.error('解析缓存数据失败:', error);
            }
        }
        return null;
    }

    async loadFromFile() {
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                multiple: false,
                types: [
                    {
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] }
                    }
                ]
            });

            const file = await fileHandle.getFile();
            const content = await file.text();
            const data = JSON.parse(content);

            localStorage.setItem(this.storageKey, content);
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                return null;
            }
            throw error;
        }
    }

    exportAsJSON(data, filename) {
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `novel-project-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    exportAsText(data, filename) {
        let content = `${data.projectName || '未命名小说'}\n`;
        content += `${'='.repeat(50)}\n\n`;

        if (data.novelInfo) {
            content += `【小说信息】\n`;
            content += `标题：${data.novelInfo.title || '未命名'}\n`;
            content += `描述：${data.novelInfo.description || '暂无'}\n`;
            if (data.novelInfo.reference) {
                content += `参考内容：${data.novelInfo.reference}\n`;
            }
            if (data.novelInfo.style) {
                content += `文风：${data.novelInfo.style}\n`;
            }
            content += `章节数：${data.novelInfo.chapterCount || '未设定'}\n\n`;
        }

        if (data.outline) {
            content += `【整体大纲】\n${data.outline}\n\n`;
        }

        if (data.detailedOutline) {
            content += `【详细细纲】\n${data.detailedOutline}\n\n`;
        }

        if (data.chapters && data.chapters.length > 0) {
            data.chapters.forEach((chapter, index) => {
                content += `第${index + 1}章 ${chapter.title || '未命名'}\n`;
                content += `摘要：${chapter.summary || '暂无'}\n\n`;
                content += `${chapter.content || '（尚未创作正文）'}\n\n`;
                if (chapter.metadata) {
                    content += `角色：${chapter.metadata.characters || '未记录'}\n`;
                    content += `剧情：${chapter.metadata.plot || '未记录'}\n`;
                    content += `伏笔：${chapter.metadata.foreshadowing || '未记录'}\n\n`;
                }
                content += `${'-'.repeat(40)}\n\n`;
            });
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `${data.projectName || '小说'}-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearProject() {
        localStorage.removeItem(this.storageKey);
        this.fileHandle = null;
        this.pendingWrite = Promise.resolve();
    }

    autoSave(data) {
        try {
            const payload = JSON.stringify(data);
            localStorage.setItem(this.storageKey, payload);

            if (this.fileHandle) {
                const prettyPayload = JSON.stringify(data, null, 2);
                this.pendingWrite = this.pendingWrite
                    .catch(() => {})
                    .then(() => this.writeToFile(prettyPayload))
                    .catch(error => {
                        console.error('自动写入文件失败:', error);
                        this.fileHandle = null;
                    });
            }
            return true;
        } catch (error) {
            console.error('自动保存失败:', error);
            return false;
        }
    }
}

window.storageService = new StorageService();
