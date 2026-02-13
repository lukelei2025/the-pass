/**
 * GLM-4 LLM 服务 - 智谱 AI
 * API 文档: https://open.bigmodel.cn/dev/api
 */

import type { Category } from '../types';
import { API_ENDPOINTS, buildWorkerUrl, REQUEST_TIMEOUT } from '../config/api';
import { extractUrl, validateCategory } from './processors/contentProcessor';


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
    resolvedUrl?: string;
    isLink: boolean;
}

export interface ClassificationResult {
    category: Category;
    metadata: ContentMetadata;
    success: boolean;  // true = AI分类成功, false = 需要手动分类
    offline?: boolean;  // 是否离线（网络原因）
    disabled?: boolean;  // 是否用户主动关闭智能分类
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
 * 统一返回格式：标题 #作者（优先）/平台（兜底）
 */
async function fetchPageTitle(url: string, timeoutMs = REQUEST_TIMEOUT.default): Promise<string | null> {
    const isWeChat = url.includes('mp.weixin.qq.com');

    // 策略 0: 如果是微信公众号，优先使用专用 Worker (抗反爬)
    if (isWeChat) {
        const wechatWorkerUrl = buildWorkerUrl(API_ENDPOINTS.wechatWorker, { url });
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

    // 策略 1: 通用 Cloudflare Worker 代理 (开发/生产环境统一)
    const workerUrl = buildWorkerUrl(API_ENDPOINTS.titleProxy, { url });

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(workerUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data.title) {
                console.log(`[Cloudflare Worker] 获取到标题: ${data.title}`, data);
                // 如果 Worker 已经返回了格式化的标题（包含 #），直接使用
                if (data.title.includes('#')) {
                    return data.title;
                }
                // 优先使用 Worker 返回的作者（确保非空）
                if (data.author && data.author.trim() && !data.title.includes('#')) {
                    return `${data.title} #${data.author}`;
                }
                // 如果没有有效作者，只返回标题，不添加平台名
                return data.title;
            }
        }
    } catch (err) {
        console.warn(`[Worker请求失败]: ${workerUrl}`, err);
    }

    return null;
}

async function resolveShortLink(url: string): Promise<string> {
    const workerUrl = buildWorkerUrl(API_ENDPOINTS.titleProxy, { url, resolve: '1' });
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT.fast);
        const response = await fetch(workerUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return url;
        }

        const data = await response.json() as any;
        if (data?.resolvedUrl && typeof data.resolvedUrl === 'string') {
            return data.resolvedUrl;
        }
    } catch {
        return url;
    }

    return url;
}

/**
 * 清理平台特有的冗长标题格式
 * 注意：不移除平台后缀，因为我们会统一添加 #平台 格式
 */
function cleanPlatformTitle(title: string, url: string): string {
    // GitHub: 提取 owner/repo，去掉冗长的前缀
    if (url.includes('github.com') && title.startsWith('GitHub - ')) {
        const repoMatch = title.match(/^GitHub - ([^:]+)/);
        if (repoMatch?.[1]) return repoMatch[1].trim();
    }

    // 其他清理（如果需要）
    // 注意：不再移除 " - 知乎" 这样的后缀，因为我们统一使用 #平台 格式

    return title;
}

/**
 * 智能分类 - 增强版 (Cloudflare Worker)
 */
export async function classifyContent(
    content: string,
    config: LLMConfig
): Promise<ClassificationResult> {
    // 1. 基础信息提取 (用于 UI 展示和 metadata)
    const extractedUrl = extractUrl(content);
    const isLink = !!extractedUrl;
    let resolvedUrl = extractedUrl;

    // 初始化元数据
    const metadata: ContentMetadata = {
        content: isLink ? extractedUrl! : content,
        originalUrl: isLink ? extractedUrl! : undefined,
        isLink,
    };

    // 2. 如果是链接，提取更多 UI 展示所需信息
    if (isLink && extractedUrl) {
        if (extractedUrl.includes('xhslink.com')) {
            resolvedUrl = await resolveShortLink(extractedUrl);
            if (resolvedUrl && resolvedUrl !== extractedUrl) {
                metadata.resolvedUrl = resolvedUrl;
                metadata.content = resolvedUrl;
            }
        }

        const platform = identifyPlatform(resolvedUrl || extractedUrl);
        if (platform) {
            metadata.platform = platform.name;
            metadata.source = platform.name;
        }

        const rawTitle = await fetchPageTitle(resolvedUrl || extractedUrl);
        if (rawTitle) {
            metadata.title = cleanPlatformTitle(rawTitle, resolvedUrl || extractedUrl);
            console.log(`[标题获取成功] ${metadata.title}`);
        }
    }

    // 3. 检查是否开启自动分类
    if (!config.enabled) {
        if (isLink && metadata.platform) {
            const platformInfo = Object.values(PLATFORM_PATTERNS).find(p => p.name === metadata.platform);
            if (platformInfo) {
                return { category: platformInfo.category, metadata, success: false, disabled: true };
            }
        }
        return { category: isLink ? 'external' : 'others', metadata, success: false, disabled: true };
    }

    // 4. 调用 Cloudflare Worker (Classify)
    try {
        const response = await fetch(API_ENDPOINTS.classifyWorker, {
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
            return { category: isLink ? 'external' : 'others', metadata, success: false, offline: response.status === 0 || !navigator.onLine };
        }

        const data = await response.json() as any;
        console.log('[Worker Classify Result]:', data);

        if (data && data.category) {
            return { category: validateCategory(data.category), metadata, success: true };
        }

        return { category: isLink ? 'external' : 'others', metadata, success: false };

    } catch (error) {
        console.error('Worker Call Failed:', error);
        // 检查是否是网络错误（离线）
        const isOffline = error instanceof TypeError && error.message.includes('fetch');
        return { category: isLink ? 'external' : 'others', metadata, success: false, offline: isOffline };
    }
}

/**
 * 测试 API 连接
 */
