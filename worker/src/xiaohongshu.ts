
import { Env } from './index';

interface XiaohongshuResult {
    title: string;
    author: string;
    content: string;
    description: string;
    images: string[];
    tags: string[];
    location: string;
    stats: {
        likes: number;
        comments: number;
        shares: number;
    };
    method: string;
    url?: string;
    note_id?: string;
}

const CONFIG = {
    CACHE_TTL: 300,
    TIMEOUT: 15000,
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * Main function to get Xiaohongshu info
 */
export async function getXiaohongshuInfo(url: string, env: Env, skipCache = false): Promise<Partial<XiaohongshuResult> | { error: string }> {
    if (!isValidXiaohongshuUrl(url)) {
        return { error: 'Invalid Xiaohongshu URL' };
    }

    const noteId = await extractNoteId(url);
    if (!noteId) {
        return { error: 'Cannot extract note ID' };
    }

    // Check Cache (unless skipCache is true)
    if (!skipCache && env.CACHE) {
        const cached = await env.CACHE.get(`xhs:${noteId}`, 'json') as XiaohongshuResult | null;
        // Ignore cache if title is "vlog" or invalid
        if (cached && cached.title && cached.title.toLowerCase() !== 'vlog') {
            return { ...cached };
        }
    }

    // Fetch Info
    const result = await fetchInfo(url, noteId, env.JINA_API_KEY);

    // Write Cache
    // Only cache if successful and title is not "vlog"
    if (env.CACHE && !('error' in result) && result.title && result.title.toLowerCase() !== 'vlog') {
        await env.CACHE.put(`xhs:${noteId}`, JSON.stringify(result), {
            expirationTtl: CONFIG.CACHE_TTL,
        });
    }

    return result;
}

async function fetchInfo(xhsUrl: string, noteId: string, apiKey?: string): Promise<Partial<XiaohongshuResult> | { error: string }> {
    const methods = [
        methodMetaTags,    // 优先：直接爬取HTML meta标签
        methodJinaReader,  // 兜底：Jina Reader
    ];

    for (const method of methods) {
        try {
            const result = await method(xhsUrl, noteId, apiKey);

            // Check against "vlog" specifically
            if (result && !('error' in result) && result.title && result.title.toLowerCase() !== 'vlog') {
                result.url = xhsUrl;
                result.note_id = noteId;
                return result;
            }

            // Log warning if "vlog" but continue to next method
            if (result && !('error' in result) && result.title && result.title.toLowerCase() === 'vlog') {
                console.warn(`${method.name} returned 'vlog', trying next method if available.`);
                continue;
            }
        } catch (error) {
            console.error(`${method.name} failed:`, error);
            continue;
        }
    }

    return {
        error: 'All methods failed or returned generic titles',
    };
}

/**
 * Method 1: Jina Reader
 */
async function methodJinaReader(xhsUrl: string, noteId: string, apiKey?: string): Promise<Partial<XiaohongshuResult> | { error: string }> {
    try {
        const cleanUrl = xhsUrl.replace(/^https?:\/\//, '');
        const jinaUrl = `https://r.jina.ai/http://${cleanUrl}`;

        const headers: Record<string, string> = { 'User-Agent': CONFIG.USER_AGENT };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(jinaUrl, {
            headers,
            signal: AbortSignal.timeout(CONFIG.TIMEOUT),
        });

        if (response.status === 429) {
            return { error: 'Rate limit exceeded' };
        }

        if (response.status !== 200) {
            return { error: `HTTP ${response.status}` };
        }

        const content = await response.text();
        return parseXiaohongshuContent(content);

    } catch (error: any) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            return { error: 'Timeout' };
        }
        return { error: error.message };
    }
}

/**
 * Method 1: Meta Tags - 直接爬取HTML
 */
async function methodMetaTags(xhsUrl: string, noteId: string, apiKey?: string): Promise<Partial<XiaohongshuResult> | { error: string }> {
    try {
        const response = await fetch(xhsUrl, {
            headers: {
                'User-Agent': CONFIG.USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            signal: AbortSignal.timeout(CONFIG.TIMEOUT),
            redirect: 'follow',
        });

        if (response.status !== 200) {
            return { error: `HTTP ${response.status}` };
        }

        const html = await response.text();

        // 提取标题
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
        const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

        let title = titleMatch ? simpleDecodeHtml(titleMatch[1]) : '';
        const description = descMatch ? simpleDecodeHtml(descMatch[1]) : '';
        const image = imageMatch ? imageMatch[1] : '';

        // 如果标题为空或无效，使用描述作为标题
        if (!title || title.toLowerCase() === 'vlog') {
            if (description) {
                title = description.length > 50 ? description.substring(0, 50) + '...' : description;
            }
        }

        // 最后尝试 <title> 标签
        if (!title || title.toLowerCase() === 'vlog') {
            const tagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (tagMatch) {
                title = simpleDecodeHtml(tagMatch[1]).replace(/\s*-\s*小红书$/, '').trim();
            }
        }

        // 尝试提取作者 - 从页面结构化数据中提取
        let author = '';

        // 方法1: 尝试从window.__INITIAL_STATE__中提取
        let initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});?/s);
        if (!initialStateMatch) {
            // 尝试更宽松的匹配
            initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[^;]+)/);
        }

        if (initialStateMatch) {
            try {
                let jsonStr = initialStateMatch[1];
                // 截取到合理的长度，避免过大
                if (jsonStr.length > 100000) {
                    jsonStr = jsonStr.substring(0, 100000);
                }
                jsonStr = jsonStr.replace(/undefined/g, 'null');

                const data = JSON.parse(jsonStr);

                // 尝试多种可能的路径
                if (data?.note?.noteDetailMap?.[noteId]?.noteCard?.user) {
                    const userData = data.note.noteDetailMap[noteId].noteCard.user;
                    author = userData.nickname || userData.name || userData.username || '';
                    console.log(`[小红书] 路径1找到作者: ${author}`);
                }

                if (!author && data?.note?.noteDetailMap) {
                    const keys = Object.keys(data.note.noteDetailMap);
                    if (keys.length > 0) {
                        const firstNote = data.note.noteDetailMap[keys[0]];
                        if (firstNote?.noteCard?.user) {
                            author = firstNote.noteCard.user.nickname ||
                                     firstNote.noteCard.user.name ||
                                     firstNote.noteCard.user.username || '';
                            console.log(`[小红书] 路径2找到作者: ${author}`);
                        }
                    }
                }
            } catch (e) {
                console.warn(`[小红书] 解析__INITIAL_STATE__失败:`, e.message);
            }
        } else {
            console.log(`[小红书] HTML长度: ${html.length}, 未找到__INITIAL_STATE__`);
        }

        // 方法2: 尝试从其他script标签中提取数据
        if (!author) {
            // 查找可能包含用户信息的script标签
            const scriptPatterns = [
                /"nickname":"([^"]+)"/,
                /"user":\{[^}]*"nickname":"([^"]+)"/,
                /"username":"([^"]+)"/,
            ];

            for (const pattern of scriptPatterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    // 验证这不是一个随机字符串
                    if (match[1].length >= 2 && match[1].length <= 50) {
                        author = match[1];
                        console.log(`[小红书] 从script标签找到作者: ${author}`);
                        break;
                    }
                }
            }
        }

        // 如果最终没找到作者，返回空字符串
        // 前端会使用平台名作为兜底

        return {
            title,
            content: description,
            description,
            images: image ? [image] : [],
            author: author || '',
            method: 'meta_tags',
            tags: [],
            location: '',
            stats: { likes: 0, comments: 0, shares: 0 }
        };

    } catch (error: any) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            return { error: 'Timeout' };
        }
        return { error: error.message };
    }
}

function parseXiaohongshuContent(content: string): Partial<XiaohongshuResult> {
    const result: Partial<XiaohongshuResult> = {
        title: '',
        author: '',
        content: '',
        description: '',
        images: [],
        tags: [],
        location: '',
        stats: { likes: 0, comments: 0, shares: 0 },
    };

    // Clean content
    let cleanContent = content
        .replace(/={20,}/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    // 1. Title - 支持多种格式
    // 格式1: "Title: xxx - 小红书"
    const titleMatch1 = cleanContent.match(/^Title:\s*([^\n]+?)\s*-\s*小红书/m);
    if (titleMatch1) {
        result.title = titleMatch1[1].trim();
    }

    // 格式2: "xxx - 小红书"
    if (!result.title) {
        const titleMatch2 = cleanContent.match(/^([^\n]+?)\s*-\s*小红书/m);
        if (titleMatch2) {
            result.title = titleMatch2[1].trim();
        }
    }

    // 格式3: "Title: xxx"（没有小红书后缀）
    if (!result.title) {
        const titleMatch3 = cleanContent.match(/^Title:\s*([^\n]+)/m);
        if (titleMatch3) {
            result.title = titleMatch3[1].trim();
        }
    }

    // 格式4: 第一行就是标题
    if (!result.title) {
        const firstLine = cleanContent.split('\n')[0];
        if (firstLine && !firstLine.includes('Title:') && !firstLine.includes('.create')) {
            result.title = firstLine.trim();
        }
    }

    // 2. Author - 改进解析逻辑
    const authorPatterns = [
        // 新格式: "作者名" 在 "by" 或 "发布者" 附近
        /by\s+([a-zA-Z0-9_]+)/i,
        /发布者[:：]\s*([a-zA-Z0-9_]+)/,
        /作者[:：]\s*([a-zA-Z0-9_]+)/,
        // 旧格式: .create
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

    // 3. Content
    const contentStartPatterns = [
        /在做过一些[^，。]+\n([\s\S]+?)(?=\n#|$)/,
        /由此做了[^，。]+\n([\s\S]+?)(?=\n#|$)/,
        /([^\n]+\.create\s*\n)([\s\S]+?)(?=\n#|$)/,
    ];

    for (const pattern of contentStartPatterns) {
        const match = cleanContent.match(pattern);
        if (match && match[2]) {
            let contentText = match[2].trim();
            contentText = cleanContentText(contentText);
            if (contentText && contentText.length > 10) {
                result.content = contentText;
                result.description = contentText.substring(0, 200);
                break;
            }
        }
    }

    if (!result.content) {
        const tagsIndex = cleanContent.indexOf('\n#');
        if (tagsIndex > 0) {
            let rawContent = cleanContent.substring(0, tagsIndex);
            rawContent = rawContent.replace(/^[^\n]+\n/, '').trim(); // Remove title line
            result.content = cleanContentText(rawContent);
            result.description = result.content?.substring(0, 200);
        }
    }

    // 4. Tags
    const tagsPatterns = [
        /#([\u4e00-\u9fa5\w]+)/g,
    ];
    for (const pattern of tagsPatterns) {
        let match;
        while ((match = pattern.exec(cleanContent)) !== null) {
            if (result.tags && !result.tags.includes(match[1])) {
                result.tags.push(match[1]);
            }
        }
    }

    // 5. Location
    const locationMatch = cleanContent.match(/(\d{2}-\d{2}\s+[\u4e00-\u9fa5\s]+)/);
    if (locationMatch) {
        result.location = locationMatch[1].trim();
    }

    // 6. Stats
    const statsMatch = cleanContent.match(/(\d+)\s+(\d+)\s+(\d+)/);
    if (statsMatch && result.stats) {
        result.stats.likes = parseInt(statsMatch[1]) || 0;
        result.stats.comments = parseInt(statsMatch[2]) || 0;
        result.stats.shares = parseInt(statsMatch[3]) || 0;
    }

    result.method = 'jina_reader';
    return result;
}

function cleanContentText(text: string): string {
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

async function extractNoteId(url: string): Promise<string | null> {
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
            return pathId || 'unknown';
        }

        return urlObj.pathname.split('/').pop() || 'unknown';
    } catch {
        return null;
    }
}

function isValidXiaohongshuUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const validHosts = [
            'xiaohongshu.com',
            'www.xiaohongshu.com',
            'xhslink.com',
            'www.xhslink.com',
        ];
        return validHosts.some(host => urlObj.hostname === host);
    } catch {
        return false;
    }
}

function simpleDecodeHtml(html: string): string {
    return html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#x60;/g, '`')
        .replace(/&#x3D;/g, '=');
}
