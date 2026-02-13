/**
 * 小红书平台处理器
 *
 * 处理小红书链接的标题抓取
 */

import { BasePlatform, TitleResult, Env } from './base';
import { CONFIG, USER_AGENTS } from '../config/constants';
import { decodeEntities } from '../utils/html';

interface XiaohongshuResult {
    title?: string;
    author?: string;
    description?: string;
    method?: string;
    error?: string;
}

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
        const methods = [
            () => this.fetchWithMetaTags(url),
            () => this.fetchWithJinaReader(url, env),
        ];

        for (const method of methods) {
            try {
                const result = await method();
                if (result?.error) {
                    continue;
                }

                if (result?.title && result.title.toLowerCase() !== 'vlog') {
                    const title = result.title.replace(/\s*-\s*小红书$/, '').trim();
                    const author = result.author || '';

                    if (cache && title) {
                        await cache.put(`xhs:${noteId}`, JSON.stringify({ title, author }), {
                            expirationTtl: 3600,
                        });
                    }

                    const titleStr = author ? `"${title}" #${author}` : `"${title}"`;
                    return { title: titleStr, author };
                }
            } catch (error: any) {
                console.error(`[小红书] Fetch failed: ${error.message}`);
                continue;
            }
        }

        return { title: null, author: '' };
    }

    /**
     * 从 URL 提取笔记 ID
     */
    private async extractNoteId(url: string): Promise<string | null> {
        try {
            const urlObj = new URL(url);

            // Standard: https://www.xiaohongshu.com/explore/ID
            const exploreMatch = urlObj.pathname.match(/\/explore\/([a-f0-9]+)/i);
            if (exploreMatch) {
                return exploreMatch[1];
            }

            // Short link: https://xhslink.com/XXXX
            if (urlObj.hostname.includes('xhslink.com')) {
                const pathId = urlObj.pathname.replace(/^\//, '').replace(/\//g, '');
                return pathId || null;
            }

            return urlObj.pathname.split('/').pop() || null;
        } catch {
            return null;
        }
    }

    private async fetchWithMetaTags(url: string): Promise<XiaohongshuResult> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENTS.XIAOHOUGSHU,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                },
                signal: AbortSignal.timeout(CONFIG.TIMEOUT),
                redirect: 'follow',
            });

            if (!response.ok) {
                return { error: `HTTP ${response.status}` };
            }

            const html = await response.text();

            const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
            const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
            const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

            let title = titleMatch ? decodeEntities(titleMatch[1]) : '';
            const description = descMatch ? decodeEntities(descMatch[1]) : '';

            if (!title || title.toLowerCase() === 'vlog') {
                if (description) {
                    title = description.length > 50 ? `${description.substring(0, 50)}...` : description;
                }
            }

            if (!title || title.toLowerCase() === 'vlog') {
                const tagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (tagMatch) {
                    title = decodeEntities(tagMatch[1]).replace(/\s*-\s*小红书$/, '').trim();
                }
            }

            let author = '';
            let initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});?/s);
            if (!initialStateMatch) {
                initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[^;]+)/);
            }

            if (initialStateMatch) {
                try {
                    let jsonStr = initialStateMatch[1];
                    if (jsonStr.length > 100000) {
                        jsonStr = jsonStr.substring(0, 100000);
                    }
                    jsonStr = jsonStr.replace(/undefined/g, 'null');
                    const data = JSON.parse(jsonStr);

                    const noteIdMatch = html.match(/\"noteId\"\s*:\s*\"([a-f0-9]+)\"/i);
                    const noteId = noteIdMatch?.[1];
                    if (noteId && data?.note?.noteDetailMap?.[noteId]?.noteCard?.user) {
                        const userData = data.note.noteDetailMap[noteId].noteCard.user;
                        author = userData.nickname || userData.name || userData.username || '';
                    }

                    if (!author && data?.note?.noteDetailMap) {
                        const keys = Object.keys(data.note.noteDetailMap);
                        if (keys.length > 0) {
                            const firstNote = data.note.noteDetailMap[keys[0]];
                            if (firstNote?.noteCard?.user) {
                                author = firstNote.noteCard.user.nickname ||
                                    firstNote.noteCard.user.name ||
                                    firstNote.noteCard.user.username || '';
                            }
                        }
                    }
                } catch {
                }
            }

            if (!author) {
                const scriptPatterns = [
                    /"nickname":"([^"]+)"/,
                    /"user":\{[^}]*"nickname":"([^"]+)"/,
                    /"username":"([^"]+)"/,
                ];

                for (const pattern of scriptPatterns) {
                    const match = html.match(pattern);
                    if (match && match[1]) {
                        if (match[1].length >= 2 && match[1].length <= 50) {
                            author = match[1];
                            break;
                        }
                    }
                }
            }

            return {
                title,
                author,
                description,
                method: 'meta_tags',
            };
        } catch (error: any) {
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                return { error: 'Timeout' };
            }
            return { error: error.message };
        }
    }

    /**
     * 使用 Jina Reader API 获取信息
     */
    private async fetchWithJinaReader(url: string, env: Env): Promise<XiaohongshuResult> {
        try {
            const cleanUrl = url.replace(/^https?:\/\//, '');
            const apiUrl = `https://r.jina.ai/http://${cleanUrl}`;
            const headers: Record<string, string> = { 'User-Agent': USER_AGENTS.XIAOHOUGSHU };
            if (env.JINA_API_KEY) {
                headers['Authorization'] = `Bearer ${env.JINA_API_KEY}`;
            }

            const response = await fetch(apiUrl, {
                headers,
                signal: AbortSignal.timeout(CONFIG.TIMEOUT),
            });

            if (response.status === 429) {
                return { error: 'Rate limit exceeded' };
            }
            if (!response.ok) {
                return { error: `HTTP ${response.status}` };
            }

            const content = await response.text();
            const result = this.parseXiaohongshuContent(content);
            return { ...result, method: 'jina_reader' };
        } catch (error: any) {
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                return { error: 'Timeout' };
            }
            return { error: error.message };
        }
    }

    private parseXiaohongshuContent(content: string): XiaohongshuResult {
        const result: XiaohongshuResult = {
            title: '',
            author: '',
            description: '',
        };

        let cleanContent = content
            .replace(/={20,}/g, '')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        const titleMatch1 = cleanContent.match(/^Title:\s*([^\n]+?)\s*-\s*小红书/m);
        if (titleMatch1) {
            result.title = titleMatch1[1].trim();
        }

        if (!result.title) {
            const titleMatch2 = cleanContent.match(/^([^\n]+?)\s*-\s*小红书/m);
            if (titleMatch2) {
                result.title = titleMatch2[1].trim();
            }
        }

        if (!result.title) {
            const titleMatch3 = cleanContent.match(/^Title:\s*([^\n]+)/m);
            if (titleMatch3) {
                result.title = titleMatch3[1].trim();
            }
        }

        if (!result.title) {
            const firstLine = cleanContent.split('\n')[0];
            if (firstLine && !firstLine.includes('Title:') && !firstLine.includes('.create')) {
                result.title = firstLine.trim();
            }
        }

        const authorPatterns = [
            /by\s+([a-zA-Z0-9_]+)/i,
            /发布者[:：]\s*([a-zA-Z0-9_]+)/,
            /作者[:：]\s*([a-zA-Z0-9_]+)/,
            /([a-zA-Z0-9_]+\.create)/,
            /([^\s]+\.create)\s*关注/,
        ];
        for (const pattern of authorPatterns) {
            const match = cleanContent.match(pattern);
            if (match && match[1] && !result.author) {
                result.author = match[1];
                break;
            }
        }

        const tagsIndex = cleanContent.indexOf('\n#');
        if (tagsIndex > 0) {
            let rawContent = cleanContent.substring(0, tagsIndex);
            rawContent = rawContent.replace(/^[^\n]+\n/, '').trim();
            const cleaned = this.cleanContentText(rawContent);
            result.description = cleaned.substring(0, 200);
        }

        return result;
    }

    private cleanContentText(text: string): string {
        const junkPatterns = [
            /\*\s*发现/,
            /\*\s*发布/,
            /\*\s*通知/,
            /登录$/,
            /我$/,
            /关注/,
            /\d+:\d+\s*\d+:\d+/, 
            /[\d.]+x\s*倍速/,
            /请\s+刷新\s+试试/,
            /内容可能使用AI技术生成/,
            /加载中/,
            /去首页.*?笔记/,
            /登录后评论/,
            /发送\s+取消/,
            /我要申诉/,
            /温馨提示/,
            /沪ICP备.*/,
            /营业执照.*/,
            /公网安备.*/,
            /增值电信.*/,
            /医疗器械.*/,
            /互联网药品.*/,
            /违法不良.*/,
            /举报中心.*/,
            /有害信息.*/,
            /自营经营者.*/,
            /网络文化.*/,
            /个性化推荐.*/,
            /行吟信息.*/,
            /地址：.*/,
            /电话：.*/,
            /©\s*\d{4}/,
            /更多$/,
            /活动$/,
            /创作服务$/,
            /直播管理$/,
            /电脑直播助手$/,
            /专业号$/,
            /推广合作$/,
            /蒲公英$/,
            /商家入驻$/,
            /MCN入驻/,
            /举报$/,
        ];

        let cleaned = text;
        for (const pattern of junkPatterns) {
            cleaned = cleaned.replace(pattern, '');
        }
        return cleaned.replace(/\n{3,}/g, '\n\n').trim();
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
