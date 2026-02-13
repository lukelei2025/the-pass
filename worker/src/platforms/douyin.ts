/**
 * 抖音平台处理器
 *
 * 处理抖音/TikTok 链接的标题抓取
 */

import { BasePlatform, TitleResult, Env } from './base';

export class DouyinPlatform extends BasePlatform {
    getName(): string {
        return 'douyin';
    }

    /**
     * 检查是否为抖音链接
     */
    canHandle(url: string): boolean {
        const hostname = this.extractHostname(url);
        return hostname.includes('douyin.com') || hostname.includes('v.douyin.com');
    }

    /**
     * 获取抖音视频标题
     */
    async fetchTitle(url: string, env: Env): Promise<TitleResult> {
        try {
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            };

            const response = await fetch(url, {
                headers,
                redirect: 'follow',
                cf: { cacheTtl: 3600, cacheEverything: true },
            } as any);

            if (!response.ok) {
                return { title: null, author: '' };
            }

            const html = await response.text();

            // 抖音返回的数据在 window._ROUTER_DATA 中
            const title = this.extractTitleFromHtml(html);

            return { title, author: '' };
        } catch (error: any) {
            console.error(`[Douyin] Fetch failed: ${error.message}`);
            return { title: null, author: '' };
        }
    }

    /**
     * 从 HTML 中提取标题
     */
    private extractTitleFromHtml(html: string): string | null {
        if (!html) return null;

        // 抖音的数据通常在 window._ROUTER_DATA 中
        const dataMatch = html.match(/window\._ROUTER_DATA\s*=\s*({.*?});/s);
        if (dataMatch) {
            try {
                const jsonStr = dataMatch[1]
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim();

                const data = JSON.parse(jsonStr);

                if (data.title) {
                    let title = data.title;

                    // 移除话题标签（#话题）
                    title = title.replace(/#\S+\s*/g, ' ').trim();

                    // 截取前80个字符
                    if (title.length > 80) {
                        title = title.substring(0, 80) + '...';
                    }

                    return title;
                }
            } catch (e) {
                // 如果解析失败，尝试从 HTML 中提取
                return this.fallbackTitleExtraction(html);
            }
        }

        return this.fallbackTitleExtraction(html);
    }

    /**
     * 备用标题提取方法
     */
    private fallbackTitleExtraction(html: string): string | null {
        if (!html) return null;

        // 尝试从 <title> 标签提取
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            return titleMatch[1].trim();
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
