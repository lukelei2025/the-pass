
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
export async function getXiaohongshuInfo(url: string, env: Env): Promise<Partial<XiaohongshuResult> | { error: string }> {
    if (!isValidXiaohongshuUrl(url)) {
        return { error: 'Invalid Xiaohongshu URL' };
    }

    const noteId = await extractNoteId(url);
    if (!noteId) {
        return { error: 'Cannot extract note ID' };
    }

    // Check Cache
    if (env.CACHE) {
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
        methodJinaReader,
        methodMetaTags,
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
 * Method 2: Meta Tags
 */
async function methodMetaTags(xhsUrl: string, noteId: string, apiKey?: string): Promise<Partial<XiaohongshuResult> | { error: string }> {
    try {
        const response = await fetch(xhsUrl, {
            headers: { 'User-Agent': CONFIG.USER_AGENT },
            signal: AbortSignal.timeout(CONFIG.TIMEOUT),
            redirect: 'follow', // Follow redirects for short links
        });

        if (response.status !== 200) {
            return { error: `HTTP ${response.status}` };
        }

        const html = await response.text();

        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
        const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

        let title = titleMatch ? simpleDecodeHtml(titleMatch[1]) : '';
        const description = descMatch ? simpleDecodeHtml(descMatch[1]) : '';
        const image = imageMatch ? imageMatch[1] : '';

        // Fallback for "vlog" title
        if ((!title || title.toLowerCase() === 'vlog') && description) {
            // Use start of description as title if title is useless
            title = description.substring(0, 50) + (description.length > 50 ? '...' : '');
        }

        // Fallback 2: <title> tag
        if (!title || title.toLowerCase() === 'vlog') {
            const tagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (tagMatch) {
                title = simpleDecodeHtml(tagMatch[1]).replace(/\s*-\s*小红书$/, '').trim();
            }
        }

        // For meta tags, we might not get author easily without more complex parsing
        const author = '';

        return {
            title,
            content: description,
            description,
            images: image ? [image] : [],
            author: author,
            method: 'meta_tags',
            tags: [],
            location: '',
            stats: { likes: 0, comments: 0, shares: 0 }
        };

    } catch (error: any) {
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

    // 1. Title
    const titleMatch = cleanContent.match(/^([^\n]+?)\s*-\s*小红书/m);
    if (titleMatch) {
        result.title = titleMatch[1].trim();
    }

    // 2. Author
    const authorPatterns = [
        /([a-zA-Z0-9_]+\.create)/,
        /([^\s]+\.create)\s*关注/,
    ];
    for (const pattern of authorPatterns) {
        const match = cleanContent.match(pattern);
        if (match && !result.author) {
            result.author = match[1];
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
