/**
 * Twitter/X 平台处理器
 *
 * 处理 Twitter/X 链接的标题抓取
 */

import { BasePlatform, TitleResult, Env } from './base';

interface TweetData {
    username?: string;
    name?: string;
    verified?: boolean;
    created_at?: string;
    public_metrics?: { tweet_count?: number };
}

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

        // 使用 Twitter API v2 获取推文
        const bearerToken = env.TWITTER_BEARER_TOKEN;
        if (!bearerToken) {
            return { title: null, author: '' };
        }

        try {
            const apiUrl = `https://api.twitter.com/2/tweets/${tweetId}?expansions=author_id&user.fields=username,name,verified&tweet.fields=created_at,public_metrics`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                },
            } as any);

            if (response.status === 401) {
                return { title: null, author: '' };
            }
            if (response.status === 403) {
                return { title: null, author: '' };
            }
            if (response.status === 404) {
                return { title: null, author: '' };
            }
            if (response.status === 429) {
                return { title: null, author: '' };
            }
            if (response.status !== 200) {
                return { title: null, author: '' };
            }

            const data = await response.json() as any;
            const tweet = data.data as TweetData;
            const user = data.includes?.users?.[0];

            if (!user) {
                return { title: null, author: '' };
            }

            // 写入缓存
            if (cache) {
                const cachedData = {
                    username: user.username,
                    author: user.username,
                };
                await cache.put(`tweet:${tweetId}`, JSON.stringify(cachedData), {
                    expirationTtl: 3600,
                });
            }

            return {
                title: tweet.text || '',
                author: user.username || '',
                method: 'twitter_api_v2',
            };
        } catch (error: any) {
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                return { title: null, author: '' };
            }
            return { title: null, author: '' };
        }
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
