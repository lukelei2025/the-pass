/**
 * 小红书平台处理器
 *
 * 处理小红书链接的标题抓取
 */

import { BasePlatform, TitleResult, Env } from './base';

export class XiaohongshuPlatform extends BasePlatform {
    getName(): string {
        return 'xiaohongshu';
    }

    /**
     * 检查是否为小红书链接
     */
    canHandle(url: string): boolean {
        const hostname = this.extractHostname(url);
        return hostname.includes('xiaohongshu.com') || hostname.includes('xhslink.com');
    }

    /**
     * 获取小红书标题
     */
    async fetchTitle(url: string, env: Env): Promise<TitleResult> {
        const noteId = await this.extractNoteId(url);
        if (!noteId) {
            return { title: null, author: '' };
        }

        // 检查缓存
        const cache = env.KV;
        if (cache) {
            const cached = await cache.get(`xhs:${noteId}`, 'json');
            if (cached && cached.title && cached.title.toLowerCase() !== 'vlog') {
                const titleStr = `"${cached.title}" #${cached.author || ''}`;
                return { title: titleStr, author: cached.author || '', cached: true };
            }
        }

        try {
            // 方法1: 尝试调用小红书 API (通过 xiaohongshu-info.ts)
            const result = await this.fetchWithXiaohongshuApi(noteId, env);
            if (result && !('error' in result)) {
                let title = result.title || '';
                const author = result.author || '';

                // 清理小红书特有的标题后缀
                title = title.replace(/\s*-\s*小红书$/, '');

                // 写入缓存
                if (cache && title) {
                    await cache.put(`xhs:${noteId}`, JSON.stringify({ title, author }), {
                        expirationTtl: 3600,
                    });
                }

                const titleStr = `"${title}" #${author}`;
                return { title: titleStr, author, method: result.method || 'jina_reader' };
            }
        } catch (error) {
            console.error(`[小红书] Fetch failed: ${error.message}`);
            return { title: null, author: '' };
        }
    }

    /**
     * 从 URL 提取笔记 ID
     */
    private async extractNoteId(url: string): Promise<string | null> {
        // Standard: https://www.xiaohongshu.com/explore/ID
        const exploreMatch = url.match(/xiaohongshu\.com\/explore\/([a-f0-9]+)/i);
        if (exploreMatch) return exploreMatch[1];

        // Short link: https://xhslink.com/XXXX
        if (url.includes('xhslink.com')) {
            const pathId = url.replace(/^https?:\/\/(www\.)?xhslink\.com\//, '').split('/')[0];
            return pathId || null;
        }

        return null;
    }

    /**
     * 使用小红书 API 获取信息
     */
    private async fetchWithXiaohongshuApi(noteId: string, env: Env): Promise<any> {
        const { JINA_API_KEY } = env;
        if (!JINA_API_KEY) {
            return { error: 'API key not configured' };
        }

        const apiUrl = `https://www.xiaohongshu.com/api/sns/note/${noteId}`;
        const headers: Record<string, string> = {
            'User-Agent': 'Xiaohongshu-Web/3.9.1',
        };

        const response = await fetch(apiUrl, { headers });
        if (!response.ok) return { error: `HTTP ${response.status}` };

        const data = await response.json();
        return data;
    }

    /**
     * 使用 Jina Reader API 获取信息
     */
    private async fetchWithJinaReader(noteId: string, env: Env): Promise<any> {
        const { JINA_API_KEY } = env;
        const cleanUrl = url.replace(/^https?:\/\//, '');

        const apiUrl = `https://r.jina.ai/http://${cleanUrl}`;
        const headers: Record<string, string> = {
            'User-Agent': 'Xiaohongshu-Web/3.9.1',
        };

        const response = await fetch(apiUrl, { headers });
        if (!response.ok) return { error: `HTTP ${response.status}` };

        const content = await response.text();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const result = JSON.parse(jsonMatch[0]);
                // 返回格式: { title, author, note_id }
                if (result.note_id) return result;
            } catch {
                // JSON 解析失败
            }
        }

        return { error: 'Jina Reader failed' };
    }

    /**
     * 提取主机名
     */
    private extractHostname(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.toLowerCase();
        } catch {
            return '';
        }
    }
}
