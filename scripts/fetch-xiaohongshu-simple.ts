/**
 * 小红书链接抓取脚本（简化版）
 *
 * 使用 https 模块直接请求，避免 fetch API 限制
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

interface FetchResult {
    title: string | null;
    author: string;
    method?: string;
    error?: string;
}

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

/**
 * 解码 HTML 实体
 */
function decodeEntities(text: string): string {
    const entities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' ',
    };

    return text.replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || match);
}

/**
 * 获取网页内容
 */
function fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            timeout: 15000,
            // 忽略SSL证书验证（仅用于开发环境）
            rejectUnauthorized: false,
        };

        const req = client.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    // 处理重定向
                    fetchUrl(res.headers.location).then(resolve).catch(reject);
                } else if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.end();
    });
}

/**
 * 从 HTML 中提取标题和作者
 */
function parseXiaohongshuHtml(html: string): FetchResult {
    const result: FetchResult = {
        title: null,
        author: '',
        method: 'direct',
    };

    // 提取 og:title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
        result.title = decodeEntities(ogTitleMatch[1]).replace(/\s*-\s*小红书$/, '').trim();
    }

    // 提取 <title> 标签作为备用
    if (!result.title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
            result.title = decodeEntities(titleMatch[1]).replace(/\s*-\s*小红书$/, '').trim();
        }
    }

    // 提取作者 - 尝试多种模式
    const authorPatterns = [
        /"nickname":"([^"]{2,50})"/,
        /"user":\{[^}]*"nickname":"([^"]+)"/,
        /"username":"([^"]{2,50})"/,
        /"name":"([^"]{2,50})"/,
    ];

    for (const pattern of authorPatterns) {
        const match = html.match(pattern);
        if (match && match[1] && !result.author) {
            result.author = match[1];
            break;
        }
    }

    return result;
}

/**
 * 主要抓取函数
 */
async function fetchXiaohongshu(url: string): Promise<FetchResult> {
    console.log(`📝 正在抓取: ${url}`);

    try {
        const html = await fetchUrl(url);
        const result = parseXiaohongshuHtml(html);

        // 验证标题
        if (!result.title || result.title.toLowerCase() === 'vlog' || result.title === '小红书') {
            return { title: null, author: '', error: 'Generic title' };
        }

        return result;
    } catch (error: any) {
        return { title: null, author: '', error: error.message };
    }
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
        console.log('  npx ts-node scripts/fetch-xiaohongshu-simple.ts <url>');
        console.log('\n示例:');
        console.log('  npx ts-node scripts/fetch-xiaohongshu-simple.ts "http://xhslink.com/o/9BlrhIXL1BD"');
        process.exit(1);
    }

    const url = args[0];

    console.log(`🔍 抓取小红书链接: ${url}`);
    console.log('');

    const result = await fetchXiaohongshu(url);

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
