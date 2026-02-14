
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
            const cached = await cache.get(`xhs:${noteId}`, 'json') as any;
            if (cached && cached.title && !this.isInvalidTitle(cached.title)) {
                // If cached author has .create, clear it but keep title
                let author = cached.author || '';
                if (author.includes('.create')) author = '';

                const titleStr = author ? `${cached.title} #${author}` : `${cached.title}`;
                return { title: titleStr, author, cached: true };
            }
        }

        const methods = [
            () => this.fetchWithMetaTags(url), // Try Meta Tags + JSON first (More reliable for official page)
            () => this.fetchWithJinaReader(url, env),
        ];

        for (const method of methods) {
            try {
                const result = await method();
                if (result?.error) {
                    continue;
                }

                if (result?.title && !this.isInvalidTitle(result.title)) {
                    const title = result.title.replace(/\s*-\s*小红书$/, '').trim();
                    let author = result.author || '';

                    if (author.includes('.create')) {
                        author = '';
                    }

                    if (cache && title) {
                        await cache.put(`xhs:${noteId}`, JSON.stringify({ title, author }), {
                            expirationTtl: 3600,
                        });
                    }

                    const titleStr = author ? `${title} #${author}` : `${title}`;
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
            // Use Desktop UA to get SSR content with __INITIAL_STATE__
            const desktopUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

            const response = await fetch(url, {
                headers: {
                    'User-Agent': desktopUA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
                signal: AbortSignal.timeout(CONFIG.TIMEOUT),
                redirect: 'follow',
            });

            if (!response.ok) {
                return { error: `HTTP ${response.status}` };
            }

            const html = await response.text();

            let title = '';
            let author = '';
            let description = '';

            // 1. Try robust JSON extraction first (Most reliable)
            const stateResult = this.extractFromInitialState(html);
            if (stateResult) {
                if (stateResult.title && !this.isInvalidTitle(stateResult.title)) title = stateResult.title;
                if (stateResult.author) author = stateResult.author;
                if (stateResult.desc) description = stateResult.desc;
            }

            // 2. Fallback to Meta Tags if JSON failed or missing title
            if (this.isInvalidTitle(title)) {
                const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
                const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);

                const metaTitle = titleMatch ? decodeEntities(titleMatch[1]) : '';
                const metaDesc = descMatch ? decodeEntities(descMatch[1]) : '';

                if (!this.isInvalidTitle(metaTitle)) {
                    title = metaTitle;
                } else if (metaDesc) {
                    // Use description as title if title is vlog
                    title = metaDesc.length > 50 ? `${metaDesc.substring(0, 50)}...` : metaDesc;
                }

                if (!description) description = metaDesc;
            }

            // 3. Fallback to <title> tag
            if (this.isInvalidTitle(title)) {
                const tagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (tagMatch) {
                    const tagTitle = decodeEntities(tagMatch[1]).replace(/\s*-\s*小红书$/, '').trim();
                    if (!this.isInvalidTitle(tagTitle)) {
                        title = tagTitle;
                    }
                }
            }

            // 4. Fallback Author regex
            if (!author) {
                const authMatch = html.match(/"nickname":"([^"]+)"/);
                if (authMatch) author = authMatch[1];
            }

            // Final validation
            if (this.isInvalidTitle(title)) {
                return { error: 'Generic title' };
            }

            return {
                title: title.trim(),
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
     * Validates and extracts JSON from window.__INITIAL_STATE__
     */
    private extractFromInitialState(html: string): { title?: string, author?: string, desc?: string } | null {
        const marker = 'window.__INITIAL_STATE__=';
        const startIndex = html.indexOf(marker);
        if (startIndex === -1) return null;

        let cursor = startIndex + marker.length;
        // Skip whitespace
        while (cursor < html.length && /\s/.test(html[cursor])) cursor++;

        if (html[cursor] !== '{') return null;

        // Simple stack-based extraction
        let balance = 0;
        let inString = false;
        let escaped = false;
        let startJson = cursor;

        for (let i = cursor; i < html.length; i++) {
            const char = html[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') balance++;
                else if (char === '}') {
                    balance--;
                    if (balance === 0) {
                        const jsonStr = html.substring(startJson, i + 1);
                        try {
                            const cleanJson = jsonStr.replace(/undefined/g, 'null');
                            const data = JSON.parse(cleanJson);

                            // Traverse common paths
                            let title, author, desc;

                            // Path 1: note.note
                            if (data?.note?.note) {
                                title = data.note.note.title;
                                desc = data.note.note.desc;
                                author = data.note.note.user?.nickname || data.note.note.user?.name;
                            }
                            // Path 2: note.firstNote
                            else if (data?.note?.firstNote) {
                                title = data.note.firstNote.title;
                                desc = data.note.firstNote.desc;
                                author = data.note.firstNote.user?.nickname || data.note.firstNote.user?.name;
                            }
                            // Path 3: note.noteDetailMap (Map of notes)
                            else if (data?.note?.noteDetailMap) {
                                const vals = Object.values(data.note.noteDetailMap) as any[];
                                if (vals.length > 0) {
                                    const note = vals[0].note || vals[0]; // Sometimes nested
                                    title = note.title;
                                    desc = note.desc;
                                    author = note.user?.nickname || note.user?.name;
                                }
                            }

                            return { title, author, desc };

                        } catch (e) {
                            return null;
                        }
                    }
                }
            }
        }
        return null;
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
            if (firstLine && !firstLine.includes('Title:') && firstLine.length < 100) {
                result.title = firstLine.trim();
            }
        }

        const authorPatterns = [
            /by\s+([a-zA-Z0-9_\u4e00-\u9fa5]+)/i,
            /发布者[:：]\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)/,
            /作者[:：]\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)/,
        ];

        for (const pattern of authorPatterns) {
            const match = cleanContent.match(pattern);
            if (match && match[1] && !result.author) {
                if (!match[1].includes('.create')) {
                    result.author = match[1];
                    break;
                }
            }
        }
        return result;
    }

    private extractHostname(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.toLowerCase();
        } catch {
            return '';
        }
    }

    private isInvalidTitle(title: string | undefined | null): boolean {
        if (!title) return true;

        const lower = title.toLowerCase().trim();
        if (lower === '' || lower === 'vlog' || lower === '小红书') return true;

        const stripped = lower.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
        if (stripped === 'vlog') return true;

        return false;
    }
}
