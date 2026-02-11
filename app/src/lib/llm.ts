/**
 * GLM-4 LLM 服务 - 智谱 AI
 * API 文档: https://open.bigmodel.cn/dev/api
 */

import type { Category } from '../types';
import { CLASSIFICATION_RULES } from './classification-rules';

const GLM_API_URL = 'https://open.bigmodel.cn/api/coding/paas/v4/chat/completions';

export interface LLMConfig {
    apiKey: string;
    enabled: boolean;
}

export interface ContentMetadata {
    content: string;
    title?: string;
    source?: string;
    platform?: string;
    originalUrl?: string; // 只有当内容包含链接时才会有此字段
    isLink: boolean;
}

/**
 * 已知平台识别
 */
const PLATFORM_PATTERNS: Record<string, { name: string; category: Category }> = {
    'mp.weixin.qq.com': { name: '微信公众号', category: 'article' },
    'weixin.qq.com': { name: '微信', category: 'article' },
    'xiaohongshu.com': { name: '小红书', category: 'article' },
    'xhslink.com': { name: '小红书', category: 'article' },
    'zhihu.com': { name: '知乎', category: 'article' },
    'zhuanlan.zhihu.com': { name: '知乎专栏', category: 'article' },
    'bilibili.com': { name: 'B站', category: 'article' },
    'b23.tv': { name: 'B站', category: 'article' },
    'douyin.com': { name: '抖音', category: 'article' },
    'v.douyin.com': { name: '抖音', category: 'article' },
    'youtube.com': { name: 'YouTube', category: 'article' },
    'youtu.be': { name: 'YouTube', category: 'article' },
    'twitter.com': { name: 'Twitter/X', category: 'article' },
    'x.com': { name: 'Twitter/X', category: 'article' },
    'github.com': { name: 'GitHub', category: 'article' },
    'notion.so': { name: 'Notion', category: 'article' },
    'feishu.cn': { name: '飞书', category: 'article' },
    'dingtalk.com': { name: '钉钉', category: 'article' },
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
 * 策略: 优先使用本地 Vite 代理（绕过 CORS），失败则回退到 AllOrigins
 */
/**
 * 尝试获取网页标题
 * 策略:
 * 1. 开发环境: 使用本地 Vite 代理 (最可靠)
 * 2. 生产环境: 使用公共 CORS 代理 (corsproxy.io 或 allorigins)
 */
async function fetchPageTitle(url: string, timeoutMs = 30000): Promise<string | null> {
    // 策略 1: 本地 Vite 开发服务器代理 (仅 Dev 环境可用)
    if (import.meta.env.DEV) {
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

    // 策略 2: Cloudflare Worker 代理 (生产环境唯一指定方案)
    // 自建 Worker 支持自定义 UA，专治飞书/微信等反爬
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
 * - GitHub: "GitHub - owner/repo: 很长的 About 描述" → "owner/repo"
 * - 知乎: "标题 - 知乎" → "标题"
 * - 飞书: "标题 - 飞书云文档" → "标题"
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
 * 不再负责解析标题或用户说明，这两者交给 LLM 在分类时处理
 */
function extractUrl(input: string): string | null {
    const match = input.match(/(https?:\/\/[^\s]+)/);
    return match ? match[1] : null;
}

/**
 * 检查 API 是否已配置
 */
export function isApiConfigured(config: LLMConfig): boolean {
    return config.enabled && config.apiKey.length > 0;
}

/**
 * 构建增强版分类 prompt
 * 使用完整的分类规则 SOP
 */
function buildEnhancedPrompt(rawData: string, metadata: ContentMetadata): string {
    // 使用完整的分类规则 SOP
    let prompt = CLASSIFICATION_RULES + '\n\n---\n\n## 待分类内容\n\n';

    // 核心改变：直接把用户原始输入作为一个整体传给 LLM
    // 让 LLM 自己去理解其中的 URL、标题、还是用户意图
    prompt += `用户原始输入:\n"""\n${rawData}\n"""\n\n`;

    // 补充一些代码层提取到的事实信息，供 LLM 参考（但以原始输入为主）
    if (metadata.isLink) {
        prompt += `(系统检测到的事实信息：包含链接 ${metadata.originalUrl}`;
        if (metadata.platform) {
            prompt += `，来自平台 ${metadata.platform}`;
        }
        if (metadata.title) {
            prompt += `，网页标题 "${metadata.title}"`;
        }
        prompt += `)\n`;
    }

    prompt += `\n请根据以上分类规则，分析用户的原始输入，只返回分类标识（inspiration/work/personal/article/other），不要返回其他任何内容。`;

    return prompt;
}

/**
 * 智能分类 - 增强版
 * 
 * 架构重构：
 * 1. 代码层：只负责提取 URL、识别平台、抓取网页标题（用于 UI 展示）
 * 2. 逻辑层：将【用户完整原始输入】传给 LLM，由 LLM 根据规则判断分类
 */
export async function classifyContent(
    content: string,
    config: LLMConfig
): Promise<{ category: Category; metadata: ContentMetadata }> {
    // 1. 基础信息提取 (用于 UI 展示和 metadata)
    const extractedUrl = extractUrl(content);
    const isLink = !!extractedUrl;

    // 初始化元数据 - 始终保留 raw content 供后续使用
    // 注意：如果包含链接，content 字段会被替换为 clean URL (为了 UI 卡片点击)，
    // 但我们会把原始输入传给 LLM 进行分类判断
    const metadata: ContentMetadata = {
        content: isLink ? extractedUrl! : content,
        originalUrl: isLink ? extractedUrl! : undefined,
        isLink,
    };

    // 2. 如果是链接，提取更多 UI 展示所需信息
    if (isLink && extractedUrl) {
        // 识别平台
        const platform = identifyPlatform(extractedUrl);
        if (platform) {
            metadata.platform = platform.name;
            metadata.source = platform.name;
        }

        // 尝试获取网页标题 (仅用于显示，不再用于分类逻辑，分类逻辑看用户原始输入)
        // 只有当用户没有提供上下文时，这个标题才会在分类时起到关键补充作用
        const rawTitle = await fetchPageTitle(extractedUrl);
        if (rawTitle) {
            metadata.title = cleanPlatformTitle(rawTitle, extractedUrl);
            console.log(`[服务端抓取] 获取到网页标题: ${metadata.title}`);
        }
    }

    // 3. 开始分类流程

    // 如果 API 未配置
    if (!isApiConfigured(config)) {
        // 回退逻辑：有链接且识别到平台 → 用平台默认分类；否则 → article
        if (isLink && metadata.platform) {
            const platformInfo = Object.values(PLATFORM_PATTERNS).find(p => p.name === metadata.platform);
            if (platformInfo) {
                console.log(`LLM 未配置，使用平台默认分类: ${platformInfo.category}`);
                return { category: platformInfo.category, metadata };
            }
        }
        console.log('LLM API 未配置，使用默认规则');
        return { category: isLink ? 'article' : 'other', metadata };
    }

    // 4. 调用 LLM 进行分类 (传入完整原始 content)
    const enhancedPrompt = buildEnhancedPrompt(content, metadata);

    try {
        const response = await fetch(GLM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: 'glm-4',
                messages: [
                    {
                        role: 'user',
                        content: enhancedPrompt,
                    },
                ],
                temperature: 0.1,
                max_tokens: 20,
            }),
        });

        if (!response.ok) {
            console.error('GLM API 请求失败:', response.status, response.statusText);
            return { category: isLink ? 'article' : 'other', metadata };
        }

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim().toLowerCase();

        // 验证返回的分类是否有效
        const validCategories: Category[] = ['inspiration', 'work', 'personal', 'article', 'other'];
        if (result && validCategories.includes(result as Category)) {
            return { category: result as Category, metadata };
        }

        console.log('LLM 返回的分类无效:', result);
        return { category: isLink ? 'article' : 'other', metadata };
    } catch (error) {
        console.error('LLM 分类失败:', error);
        return { category: isLink ? 'article' : 'other', metadata };
    }
}

/**
 * 测试 API 连接
 */
export async function testApiConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
        const response = await fetch(GLM_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'glm-4',
                messages: [{ role: 'user', content: '你好' }],
                max_tokens: 10,
            }),
        });

        if (response.ok) {
            return { success: true, message: 'API 连接成功！' };
        } else {
            const error = await response.json();
            return { success: false, message: `API 错误: ${error.error?.message || response.statusText}` };
        }
    } catch (error) {
        return { success: false, message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}` };
    }
}
