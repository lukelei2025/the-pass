/**
 * Worker 配置常量
 */

export const CONFIG = {
    CACHE_TTL: 300, // 5分钟缓存
    TIMEOUT: 15000, // 15秒超时
} as const;

export const USER_AGENTS = {
    GENERIC: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.google.com/bot.html)',
    XIAOHOUGSHU: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    WECHAT: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    DOUYIN: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
} as const;
