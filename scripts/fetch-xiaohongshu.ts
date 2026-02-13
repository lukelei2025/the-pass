/**
 * 小红书链接抓取脚本
 *
 * 用法：
 *   npm install ts-node typescript
 *   npx ts-node scripts/fetch-xiaohongshu.ts <url>
 */

interface FetchResult {
    title: string | null;
    author: string;
    method?: string;
    error?: string;
}

const CONFIG = {
    TIMEOUT: 15000, // 15秒超时
} as const;

const USER_AGENTS = {
    XIAOHOUGSHU: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    GENERIC: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.google.com/bot.html)',
} as const;

/**
 * 解码 HTML 实体
 */
function decodeEntities(text: string | null): string {
    if (!text) return '';
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
}

/**
 * 从 URL 提取笔记 ID
 */
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
            return pathId || null;
        }

        return urlObj.pathname.split('/').pop() || null;
    } catch {
        return null;
    }
}

/**
 * 清理内容文本
 */
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

/**
 * 解析小红书内容
 */
function parseXiaohongshuContent(content: string): FetchResult {
    const result: FetchResult = {
        title: '',
        author: '',
    };

    let cleanContent = content
        .replace(/={20,}/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');

    // 提取标题 - 多种模式
    const titlePatterns = [
        /^Title:\s*([^\n]+?)\s*-\s*小红书/m,
        /^([^\n]+?)\s*-\s*小红书/m,
        /^Title:\s*([^\n]+)/m,
    ];

    for (const pattern of titlePatterns) {
        const match = cleanContent.match(pattern);
        if (match && match[1] && !result.title) {
            result.title = match[1].trim();
            break;
        }
    }

    // 如果还没找到标题，使用第一行
    if (!result.title) {
        const firstLine = cleanContent.split('\n')[0];
        if (firstLine && !firstLine.includes('Title:') && !firstLine.includes('.create')) {
            result.title = firstLine.trim();
        }
    }

    // 提取作者
    const authorPatterns = [
        /by\s+([a-zA-Z0-9_\u4e00-\u9fa5]+)/i,
        /发布者[:：]\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)/,
        /作者[:：]\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)/,
        /([a-zA-Z0-9_\u4e00-\u9fa5]+\.create)/,
        /([^\s]+\.create)\s*关注/,
    ];

    for (const pattern of authorPatterns) {
        const match = cleanContent.match(pattern);
        if (match && match[1] && !result.author) {
            result.author = match[1];
            break;
        }
    }

    return result;
}

/**
 * 使用 Jina Reader API 获取信息
 */
async function fetchWithJinaReader(url: string, jinaApiKey?: string): Promise<FetchResult> {
    try {
        const cleanUrl = url.replace(/^https?:\/\//, '');
        const apiUrl = `https://r.jina.ai/http://${cleanUrl}`;
        const headers: Record<string, string> = {
            'User-Agent': USER_AGENTS.XIAOHOUGSHU,
        };
        if (jinaApiKey) {
            headers['Authorization'] = `Bearer ${jinaApiKey}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

        const response = await fetch(apiUrl, {
            headers,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
            return { title: null, author: '', error: 'Rate limit exceeded' };
        }
        if (!response.ok) {
            return { title: null, author: '', error: `HTTP ${response.status}` };
        }

        const content = await response.text();
        const result = parseXiaohongshuContent(content);
        return { ...result, method: 'jina_reader' };
    } catch (error: any) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            return { title: null, author: '', error: 'Timeout' };
        }
        return { title: null, author: '', error: error.message };
    }
}

/**
 * 使用 Meta 标签获取信息
 */
async function fetchWithMetaTags(url: string): Promise<FetchResult> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

        // Node.js 18+ 的 fetch API
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENTS.XIAOHOUGSHU,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0',
            },
            signal: controller.signal,
            redirect: 'follow',
        } as RequestInit);

        clearTimeout(timeoutId);

        if (!response.ok) {
            return { title: null, author: '', error: `HTTP ${response.status}` };
        }

        const html = await response.text();

        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
        const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);

        let title = titleMatch ? decodeEntities(titleMatch[1]) : '';
        const description = descMatch ? decodeEntities(descMatch[1]) : '';

        const trimmedTitle = title.trim();
        if (!trimmedTitle || trimmedTitle.toLowerCase() === 'vlog' || trimmedTitle === '小红书') {
            return { title: null, author: '', error: 'Generic title' };
        }

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

        const finalTitle = title.trim();
        if (!finalTitle || finalTitle.toLowerCase() === 'vlog' || finalTitle === '小红书') {
            return { title: null, author: '', error: 'Generic title' };
        }

        // 提取作者
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

                if (data?.note?.noteDetailMap) {
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
                // 忽略解析错误
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
            title: finalTitle,
            author,
            method: 'meta_tags',
        };
    } catch (error: any) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            return { title: null, author: '', error: 'Timeout' };
        }
        return { title: null, author: '', error: error.message };
    }
}

/**
 * 主要抓取函数
 */
async function fetchXiaohongshu(url: string, jinaApiKey?: string): Promise<FetchResult> {
    const noteId = await extractNoteId(url);
    if (!noteId) {
        return { title: null, author: '', error: 'Invalid URL' };
    }

    console.log(`📝 笔记 ID: ${noteId}`);

    // 尝试不同的方法
    const methods = [
        () => fetchWithJinaReader(url, jinaApiKey),
        () => fetchWithMetaTags(url),
    ];

    for (const method of methods) {
        try {
            const result = await method();
            if (result?.error) {
                console.log(`⚠️  方法失败 (${result.method}): ${result.error}`);
                continue;
            }

            if (result?.title && result.title.toLowerCase() !== 'vlog') {
                const title = result.title.replace(/\s*-\s*小红书$/, '').trim();
                return { title, author: result.author || '', method: result.method };
            }
        } catch (error: any) {
            console.log(`⚠️  方法失败: ${error.message}`);
            continue;
        }
    }

    return { title: null, author: '', error: 'All methods failed' };
}

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);

    console.log('📝 参数数量:', args.length);
    console.log('📝 参数列表:', args);

    if (args.length === 0) {
        console.log('❌ 请提供小红书链接');
        console.log('\n用法:');
        console.log('  npx ts-node scripts/fetch-xiaohongshu.ts <url> [jina_api_key]');
        console.log('\n示例:');
        console.log('  npx ts-node scripts/fetch-xiaohongshu.ts http://xhslink.com/o/9BlrhIXL1BD');
        console.log('  npx ts-node scripts/fetch-xiaohongshu.ts http://xhslink.com/o/9BlrhIXL1BD YOUR_JINA_API_KEY');
        process.exit(1);
    }

    const url = args[0];
    const jinaApiKey = args[1] || process.env.JINA_API_KEY;

    console.log(`🔍 抓取小红书链接: ${url}`);
    if (jinaApiKey) {
        console.log('🔑 使用 Jina Reader API');
    } else {
        console.log('⚠️  未提供 Jina API Key，使用备用方法');
    }
    console.log('');

    const result = await fetchXiaohongshu(url, jinaApiKey);

    console.log('--- 抓取结果 ---');
    if (result.title) {
        console.log(`✅ 标题: ${result.title}`);
        console.log(`👤 作者: ${result.author || '(未找到)'}`);
        console.log(`🔧 方法: ${result.method || 'unknown'}`);
    } else {
        console.log(`❌ 抓取失败: ${result.error || '未知错误'}`);
    }

    // 返回 JSON 格式供程序使用
    console.log('\n--- JSON 输出 ---');
    console.log(JSON.stringify(result, null, 2));
}

// 运行主函数
main().catch(console.error);
