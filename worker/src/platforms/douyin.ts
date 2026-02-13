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
        const resolvedUrl = await this.resolveShortLink(url);
        try {
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
            };

            const response = await fetch(resolvedUrl, {
                headers,
                redirect: 'follow',
                cf: { cacheTtl: 3600, cacheEverything: true },
            } as any);

            if (!response.ok) {
                return { title: null, author: '', method: 'douyin_html', error: `HTTP ${response.status}` };
            }

            const html = await response.text();

            // 抖音返回的数据在 window._ROUTER_DATA 中
            const { title, author } = this.extractMetadataFromHtml(html);

            return { title, author, method: 'douyin_html' };
        } catch (error: any) {
            console.error(`[Douyin] Fetch failed: ${error.message}`);
            return { title: null, author: '', method: 'douyin_html', error: 'Request failed' };
        }
    }

    private async resolveShortLink(url: string): Promise<string> {
        if (!url.includes('v.douyin.com')) {
            return url;
        }

        try {
            const response = await fetch(url, {
                redirect: 'manual',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                },
            } as any);

            const location = response.headers.get('location');
            if (location) {
                return location;
            }

            return response.url || url;
        } catch {
            return url;
        }
    }

    /**
     * 从 HTML 中提取标题
     */
    private extractMetadataFromHtml(html: string): { title: string | null; author: string } {
        if (!html) return { title: null, author: '' };

        const routerIndex = html.indexOf('window._ROUTER_DATA');
        if (routerIndex !== -1) {
            try {
                const braceStart = html.indexOf('{', routerIndex);
                const scriptEnd = html.indexOf('</script>', braceStart);
                if (braceStart !== -1 && scriptEnd !== -1) {
                    let jsonStr = html.slice(braceStart, scriptEnd).trim();
                    if (jsonStr.endsWith(';')) {
                        jsonStr = jsonStr.slice(0, -1);
                    }
                    jsonStr = jsonStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                    const data = JSON.parse(jsonStr);
                    const item = data?.loaderData?.['video_(id)/page']?.videoInfoRes?.item_list?.[0];
                    if (item) {
                        let title = item.desc || '';
                        const author = item.author?.nickname || '';

                        title = title.replace(/#\S+\s*/g, ' ').trim();
                        if (title.length > 80) {
                            title = title.substring(0, 80) + '...';
                        }

                        if (!title) {
                            const fallback = this.fallbackTitleExtraction(html);
                            return { title: fallback, author };
                        }

                        return { title: title || null, author };
                    }
                }
            } catch {
            }
        }

        const fallback = this.fallbackTitleExtraction(html);
        return { title: fallback, author: '' };
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
