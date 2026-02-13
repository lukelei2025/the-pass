/**
 * 平台处理器基类
 *
 * 所有平台处理器必须实现此接口，确保一致性
 */

export interface TitleResult {
    title: string | null;
    author: string;
    cached?: boolean;
}

export interface Env {
    TWITTER_BEARER_TOKEN?: string;
    GLM_API_KEY?: string;
    JINA_API_KEY?: string;
    KV?: KVNamespace;
}

export interface PlatformHandler {
    /**
     * 检查此平台是否能处理给定的 URL
     */
    canHandle(url: string): boolean;

    /**
     * 获取网页标题
     */
    fetchTitle(url: string, env: Env): Promise<TitleResult>;

    /**
     * 获取平台名称
     */
    getName(): string;
}

/**
 * 平台基类 - 定义接口规范
 * 子类必须实现 canHandle、fetchTitle 和 getName 方法
 */
export abstract class BasePlatform implements PlatformHandler {
    /**
     * 获取平台名称
     */
    abstract getName(): string;

    /**
     * 检查是否能处理此 URL（默认返回 false）
     */
    canHandle(url: string): boolean {
        return false;
    }

    /**
     * 获取标题（默认实现，子类应重写）
     */
    async fetchTitle(url: string, env: Env): Promise<TitleResult> {
        // 默认通用实现
        return { title: null, author: '' };
    }
}
