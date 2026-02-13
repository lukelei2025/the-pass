/**
 * 微信公众号平台处理器
 *
 * 处理微信公众号（mp.weixin.qq.com）的标题抓取
 */

import { BasePlatform, TitleResult, Env } from './base';

export class WeChatPlatform extends BasePlatform {
    getName(): string {
        return 'wechat';
    }

    /**
     * 检查是否为微信文章链接
     */
    canHandle(url: string): boolean {
        const hostname = this.extractHostname(url);
        return (
            hostname.includes('mp.weixin.qq.com') ||
            hostname.includes('weixin.qq.com')
        );
    }

    /**
     * 获取微信文章标题
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
            // 使用微信专用 User-Agent
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
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
            const title = this.extractTitle(html, finalUrl);

            // 写入缓存
            if (cache && title) {
                await cache.put(url, JSON.stringify({ title, author: '' }), {
                    expirationTtl: 3600, // 1 hour
                });
            }

            return { title, author: '' };
        } catch (error) {
            console.error(`[WeChat] Fetch failed: ${error.message}`);
            return { title: null, author: '' };
        }
    }

    /**
     * 从 HTML 中提取标题
     */
    private extractTitle(html: string, url: string): string | null {
        if (!html) return null;

        let title: string | null = null;

        // 方法 1: og:title
        const ogMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
            title = ogMatch[1].trim();
        }

        // 方法 2: 微信专用 msg_title
        if (!title) {
            const msgMatch = html.match(/msg_title\s*=\s*(?:window\.title\s*=\s*)?["']([^"']+)["']/);
            if (msgMatch && msgMatch[1]) {
                title = decodeURIComponent(msgMatch[1]).trim();
            }
        }

        // 方法 3: <title> 标签
        if (!title) {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].trim();
            }
        }

        // 方法 4: h1 标签
        if (!title) {
            const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            if (h1Match && h1Match[1]) {
                let clean = h1Match[1].replace(/<[^>]+>/g, '').trim();
                if (clean) {
                    title = decodeURIComponent(clean);
                }
            }
        }

        // 清理小红书特有的标题后缀
        if (title && url.includes('xiaohongshu.com')) {
            title = title.replace(/\s*-\s*小红书$/, '');
        }

        return title;
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

    /**
     * 解码 HTML 实体
     */
    private decodeEntities(text: string): string {
        if (!text) return '';
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
    }
}
