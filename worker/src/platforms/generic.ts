/**
 * 通用平台处理器（兜底）
 *
 * 处理不被其他平台识别的通用网址
 */

import { BasePlatform, TitleResult, Env } from './base';

export class GenericPlatform extends BasePlatform {
    getName(): string {
        return 'generic';
    }

    /**
     * 兜底处理器可以处理所有 URL
     */
    canHandle(url: string): boolean {
        return true;
    }

    /**
     * 通用标题抓取
     */
    async fetchTitle(url: string, env: Env): Promise<TitleResult> {
        // 检查缓存
        const cache = env.KV;
        if (cache) {
            const cached = await cache.get(url, 'json');
            if (cached) {
                return { title: cached.title, author: cached.author || '', cached: true };
            }
        }

        try {
            // 使用通用的 User-Agent
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.google.com/bot.html)',
            };

            const response = await fetch(url, {
                headers,
                redirect: 'follow',
                cf: { cacheTtl: 3600, cacheEverything: true },
            } as any);

            if (!response.ok) {
                return { title: null, author: '' };
            }

            const finalUrl = response.url;
            const html = await response.text();

            // 提取标题
            const title = this.extractTitle(html);

            // 写入缓存
            if (cache && title) {
                await cache.put(url, JSON.stringify({ title, author: '' }), {
                    expirationTtl: 3600,
                });
            }

            return { title, author: '' };
        } catch (error: any) {
            console.error(`[Generic] Fetch failed: ${error.message}`);
            return { title: null, author: '' };
        }
    }

    /**
     * 从 HTML 中提取标题（多种方法）
     */
    private extractTitle(html: string): string | null {
        if (!html) return null;

        let title: string | null = null;

        // 方法 1: og:title
        const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
            title = ogMatch[1].trim();
        }

        // 方法 2: <title> 标签
        if (!title) {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].trim();
            }
        }

        // 方法 3: h1 标签
        if (!title) {
            const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1Match && h1Match[1]) {
                let clean = h1Match[1].replace(/<[^>]+>/g, '').trim();
                if (clean) {
                    title = clean;
                }
            }
        }

        return title;
    }
}
