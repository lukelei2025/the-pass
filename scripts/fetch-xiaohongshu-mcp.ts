/**
 * 小红书链接抓取脚本（MCP版）
 *
 * 使用 MCP Web Reader 服务抓取小红书链接
 * 适用于有 MCP 环境的用户
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface FetchResult {
    title: string | null;
    author: string;
    url: string;
    content?: string;
    error?: string;
}

/**
 * 从 MCP web_reader 返回的内容中解析小红书信息
 */
function parseXiaohongshuContent(content: string, url: string): FetchResult {
    const result: FetchResult = {
        title: null,
        author: '',
        url,
        content,
    };

    // 清理内容
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
 * 使用 curl 配合 web_reader API 获取内容
 *
 * 注意：这需要你有访问 web_reader API 的权限
 */
async function fetchWithWebReader(url: string): Promise<FetchResult> {
    try {
        console.log('📝 使用 Web Reader API 获取内容...');

        // 如果你有可用的 web_reader API，在这里调用
        // 这只是一个示例框架
        const apiUrl = `https://your-web-reader-api.com/fetch?url=${encodeURIComponent(url)}`;

        const { stdout } = await execAsync(`curl -s "${apiUrl}"`);
        const data = JSON.parse(stdout);

        return parseXiaohongshuContent(data.content, url);
    } catch (error: any) {
        return {
            title: null,
            author: '',
            url,
            error: error.message,
        };
    }
}

/**
 * 主要抓取函数
 */
async function fetchXiaohongshu(url: string): Promise<FetchResult> {
    console.log(`🔍 抓取小红书链接: ${url}`);
    console.log('');

    // 方法1: 尝试 Web Reader API
    const result1 = await fetchWithWebReader(url);
    if (result1.title) {
        return result1;
    }

    // 方法2: 如果有 MCP 环境，可以直接调用
    // 这里需要根据你的实际 MCP 配置调整

    return {
        title: null,
        author: '',
        url,
        error: 'All methods failed',
    };
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
        console.log('  npx ts-node scripts/fetch-xiaohongshu-mcp.ts <url>');
        console.log('\n示例:');
        console.log('  npx ts-node scripts/fetch-xiaohongshu-mcp.ts "http://xhslink.com/o/9BlrhIXL1BD"');
        console.log('\n注意:');
        console.log('  此脚本需要配置 Web Reader API 或 MCP 环境');
        process.exit(1);
    }

    const url = args[0];

    const result = await fetchXiaohongshu(url);

    console.log('--- 抓取结果 ---');
    if (result.title) {
        console.log(`✅ 标题: ${result.title}`);
        console.log(`👤 作者: ${result.author || '(未找到)'}`);
    } else {
        console.log(`❌ 抓取失败: ${result.error || '未知错误'}`);
    }

    // 返回 JSON 格式供程序使用
    console.log('\n--- JSON 输出 ---');
    console.log(JSON.stringify(result, null, 2));
}

// 运行主函数
main().catch(console.error);
