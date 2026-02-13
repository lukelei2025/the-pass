/**
 * Twitter/X 平台处理器
 *
 * 处理 Twitter/X 链接的标题抓取
 */

import { BasePlatform, TitleResult, Env } from './base';

export class TwitterPlatform extends BasePlatform {
    getName(): string {
        return 'twitter';
    }

    /**
     * 检查是否为 Twitter/X 链接
     */
    canHandle(url: string): boolean {
        const hostname = this.extractHostname(url);
        return hostname.includes('twitter.com') || hostname.includes('x.com');
    }

    /**
     * 获取 Tweet 信息
     */
    async fetchTitle(url: string, env: Env): Promise<TitleResult> {
        // 提取 Tweet ID
        const tweetId = this.extractTweetId(url);
        if (!tweetId) {
            return { title: null, author: '' };
        }

        // 检查缓存
        const cache = env.KV;
        if (cache) {
            const cached = await cache.get(`tweet:${tweetId}`, 'json');
            if (cached) {
                const titleStr = `"${cached.title}" #${cached.author}`;
                return { title: titleStr, author: cached.username || '', cached: true };
            }
        }

        return await this.fetchWithJina(url, env);
    }

    private async fetchWithJina(url: string, env: Env): Promise<TitleResult> {
        try {
            const cleanUrl = url.replace(/^https?:\/\//, '');
            const apiUrl = `https://r.jina.ai/http://${cleanUrl}`;
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            };
            if (env.JINA_API_KEY) {
                headers['Authorization'] = `Bearer ${env.JINA_API_KEY}`;
            }

            const response = await fetch(apiUrl, {
                headers,
                signal: AbortSignal.timeout(15000),
            } as any);

            if (!response.ok) {
                return { title: null, author: '', method: 'twitter_jina', error: `Jina HTTP ${response.status}` };
            }

            const content = await response.text();
            const { title, author } = this.parseJinaTweet(content);
            if (!title && !author) {
                return { title: null, author: '', method: 'twitter_jina', error: 'Jina parse failed' };
            }

            return { title: title || null, author: author || '', method: 'twitter_jina' };
        } catch (error: any) {
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                return { title: null, author: '', method: 'twitter_jina', error: 'Jina timeout' };
            }
            return { title: null, author: '', method: 'twitter_jina', error: 'Jina request failed' };
        }
    }

    private parseJinaTweet(content: string): { title: string | null; author: string | null } {
        const titleLine = content.split('\n').find(line => line.startsWith('Title:')) || '';
        if (titleLine) {
            const raw = titleLine.replace(/^Title:\s*/, '').trim();
            const match = raw.match(/^(.*?)\s+on X:\s+"([\s\S]*?)"\s*\/\s*X$/);
            if (match) {
                return { author: match[1].trim(), title: match[2].trim() };
            }
            const fallback = raw.replace(/\s*\/\s*X$/i, '').trim();
            if (fallback) {
                return { author: null, title: fallback };
            }
        }

        const paragraphMatch = content.match(/\nMarkdown Content:\n([\s\S]+)/);
        if (paragraphMatch?.[1]) {
            const firstLine = paragraphMatch[1].split('\n').find(line => line.trim().length > 0);
            if (firstLine) {
                return { author: null, title: firstLine.trim() };
            }
        }

        return { title: null, author: null };
    }

    /**
     * 从 URL 提取 Tweet ID
     */
    private extractTweetId(url: string): string | null {
        const patterns = [
            /twitter\.com\/\w+\/status\/(\d+)/,
            /x\.com\/\w+\/status\/(\d+)/,
            /mobile\.twitter\.com\/\w+\/status\/(\d+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
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
