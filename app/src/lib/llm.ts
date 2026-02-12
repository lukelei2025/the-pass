/**
 * GLM-4 LLM 服务 - 智谱 AI
 * API 文档: https://open.bigmodel.cn/dev/api
 */

import type { Category } from '../types';


export interface LLMConfig {
    enabled: boolean;
    // apiKey removed as it's now backend-only
}

export interface ContentMetadata {
    content: string;
    title?: string;
    source?: string;
    platform?: string;
    originalUrl?: string;
    isLink: boolean;
}

/**
 * 已知平台识别
 */
const PLATFORM_PATTERNS: Record<string, { name: string; category: Category }> = {
    'mp.weixin.qq.com': { name: '微信公众号', category: 'external' },
    'weixin.qq.com': { name: '微信', category: 'external' },
    'xiaohongshu.com': { name: '小红书', category: 'external' },
    'xhslink.com': { name: '小红书', category: 'external' },
    'zhihu.com': { name: '知乎', category: 'external' },
    'zhuanlan.zhihu.com': { name: '知乎专栏', category: 'external' },
    'bilibili.com': { name: 'B站', category: 'external' },
    'b23.tv': { name: 'B站', category: 'external' },
    'douyin.com': { name: '抖音', category: 'external' },
    'v.douyin.com': { name: '抖音', category: 'external' },
    'youtube.com': { name: 'YouTube', category: 'external' },
    'youtu.be': { name: 'YouTube', category: 'external' },
    'twitter.com': { name: 'Twitter/X', category: 'external' },
    'x.com': { name: 'Twitter/X', category: 'external' },
    'github.com': { name: 'GitHub', category: 'external' },
    'notion.so': { name: 'Notion', category: 'external' },
    'feishu.cn': { name: '飞书', category: 'external' },
    'dingtalk.com': { name: '钉钉', category: 'external' },
    'taobao.com': { name: '淘宝', category: 'personal' },
    'jd.com': { name: '京东', category: 'personal' },
    'tmall.com': { name: '天猫', category: 'personal' },
};

/**
 * 从 URL 识别平台
 */
export function identifyPlatform(url: string): { name: string; category: Category } | null {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        for (const [pattern, info] of Object.entries(PLATFORM_PATTERNS)) {
            if (hostname.includes(pattern)) {
                return info;
            }
        }
    } catch {
        // URL 解析失败
    }
    return null;
}

/**
 * 尝试获取网页标题
 */
async function fetchPageTitle(url: string, timeoutMs = 30000): Promise<string | null> {
    const isWeChat = url.includes('mp.weixin.qq.com');

    // 策略 0: 如果是微信公众号，优先使用专用 Worker (抗反爬)
    if (isWeChat) {
        // TODO: 请替换为你实际部署后的 Worker URL
        const wechatWorkerUrl = `https://wechat-title-api.lukelei-workbench.workers.dev/?url=${encodeURIComponent(url)}`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const response = await fetch(wechatWorkerUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.title) {
                    console.log(`[WeChat Worker] 获取到标题: ${data.title}`);
                    // 优先使用公众号名称 (account)，其次是作者 (author)
                    const authorName = data.author?.account || data.author?.author || data.account;
                    return authorName ? `${data.title} #${authorName}` : data.title;
                }
            }
        } catch (err) {
            console.warn('[WeChat Worker] 请求失败:', err);
        }
    }

    // 策略 1: 本地 Vite 开发服务器代理 (仅 Dev 环境可用)
    // 注意: Twitter/X 需要 oEmbed 支持，本地代理可能不稳定，建议 Twitter 链接直接走 Worker
    if (import.meta.env.DEV && !url.includes('twitter.com') && !url.includes('x.com')) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const proxyUrl = `/api/fetch-title?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.title) {
                    console.log(`[本地代理] 获取到标题: ${data.title}`);
                    return data.title;
                }
            }
        } catch (err) {
            console.warn('[本地代理] 请求失败，尝试备用方案:', err);
        }
    }

    // 策略 2: 通用 Cloudflare Worker 代理 (生产环境兜底)
    const workerUrl = `https://workbench-title-proxy.lukelei-workbench.workers.dev/?url=${encodeURIComponent(url)}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(workerUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data.title) {
                console.log(`[Cloudflare Worker] 获取到标题: ${data.title}`);
                return data.title;
            }
        }
    } catch (err) {
        console.warn(`[Worker请求失败]: ${workerUrl}`, err);
    }

    return null;
}

/**
 * 清理平台特有的冗长标题格式
 */
function cleanPlatformTitle(title: string, url: string): string {
    // GitHub: 提取 owner/repo，去掉冗长的 About
    if (url.includes('github.com') && title.startsWith('GitHub - ')) {
        const repoMatch = title.match(/^GitHub - ([^:]+)/);
        if (repoMatch?.[1]) return repoMatch[1].trim();
    }

    // 知乎/飞书等：去掉尾部平台名
    const suffixes = [' - 知乎', ' - 飞书云文档', ' - 知乎专栏'];
    for (const suffix of suffixes) {
        if (title.endsWith(suffix)) return title.slice(0, -suffix.length);
    }

    return title;
}

/**
 * 简单提取文本中的 URL
 */
function extractUrl(input: string): string | null {
    const match = input.match(/(https?:\/\/[^\s]+)/);
    return match ? match[1] : null;
}

/**
 * 智能分类 - 增强版 (后端 Cloud Functions)
 */
const CLOUDFLARE_WORKER_URL = 'https://workbench-title-proxy.lukelei-workbench.workers.dev';

/**
 * 智能分类 - 增强版 (Cloudflare Worker)
 */
export async function classifyContent(
    content: string,
    config: LLMConfig
): Promise<{ category: Category; metadata: ContentMetadata }> {
    // 1. 基础信息提取 (用于 UI 展示和 metadata)
    const extractedUrl = extractUrl(content);
    const isLink = !!extractedUrl;

    // 初始化元数据
    const metadata: ContentMetadata = {
        content: isLink ? extractedUrl! : content,
        originalUrl: isLink ? extractedUrl! : undefined,
        isLink,
    };

    // 2. 如果是链接，提取更多 UI 展示所需信息
    if (isLink && extractedUrl) {
        const platform = identifyPlatform(extractedUrl);
        if (platform) {
            metadata.platform = platform.name;
            metadata.source = platform.name;
        }

        const rawTitle = await fetchPageTitle(extractedUrl);
        if (rawTitle) {
            metadata.title = cleanPlatformTitle(rawTitle, extractedUrl);
            console.log(`[标题获取成功] ${metadata.title}`);
        }
    }

    // 3. 检查是否开启自动分类
    if (!config.enabled) {
        if (isLink && metadata.platform) {
            const platformInfo = Object.values(PLATFORM_PATTERNS).find(p => p.name === metadata.platform);
            if (platformInfo) {
                return { category: platformInfo.category, metadata };
            }
        }
        return { category: isLink ? 'external' : 'others', metadata };
    }

    // 4. 调用 Cloudflare Worker (Classify)
    try {
        const response = await fetch(CLOUDFLARE_WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content,
                metadata
            }),
        });

        if (!response.ok) {
            console.error('Worker Classify Failed:', response.status);
            return { category: isLink ? 'external' : 'others', metadata };
        }

        const data = await response.json() as any;
        console.log('[Worker Classify Result]:', data);

        if (data && data.category) {
            const resultCategory = data.category.toLowerCase();
            const validCategories: Category[] = ['ideas', 'work', 'personal', 'external', 'others'];

            if (validCategories.includes(resultCategory)) {
                return { category: resultCategory as Category, metadata };
            }

            // Fallback mappings
            const mapOld: Record<string, Category> = {
                'inspiration': 'ideas',
                'article': 'external',
                'other': 'others'
            };
            if (mapOld[resultCategory]) {
                return { category: mapOld[resultCategory], metadata };
            }
        }

        return { category: isLink ? 'external' : 'others', metadata };

    } catch (error) {
        console.error('Worker Call Failed:', error);
        return { category: isLink ? 'external' : 'others', metadata };
    }
}

/**
 * 测试 API 连接
 */

