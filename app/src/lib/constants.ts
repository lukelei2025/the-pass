import type { Category, CategoryInfo, Urgency } from '../types';

/**
 * 分类信息映射
 */
export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  inspiration: {
    id: 'inspiration',
    name: '灵感',
    icon: '',
    color: 'cat-dot-inspiration',
  },
  work: {
    id: 'work',
    name: '工作',
    icon: '',
    color: 'cat-dot-work',
  },
  personal: {
    id: 'personal',
    name: '个人',
    icon: '',
    color: 'cat-dot-personal',
  },
  article: {
    id: 'article',
    name: '待看链接',
    icon: '',
    color: 'cat-dot-article',
  },
  other: {
    id: 'other',
    name: '其他',
    icon: '',
    color: 'cat-dot-other',
  },
};

/**
 * 获取剩余时间
 */
export function getRemainingTime(expiresAt: number): {
  hours: number;
  minutes: number;
  urgency: Urgency;
  isExpired: boolean;
} {
  const now = Date.now();
  const remaining = expiresAt - now;

  if (remaining <= 0) {
    return { hours: 0, minutes: 0, urgency: 'urgent', isExpired: true };
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  let urgency: Urgency = 'normal';
  if (hours < 2) urgency = 'urgent';
  else if (hours < 6) urgency = 'alert';
  else if (hours < 12) urgency = 'warning';

  return { hours, minutes, urgency, isExpired: false };
}

/**
 * 格式化剩余时间
 */
export function formatRemainingTime(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return '已过期';
  if (hours === 0) return `还剩 ${minutes} 分钟`;
  if (hours < 24) return `还剩 ${hours} 小时 ${minutes} 分`;
  return `还剩 ${hours} 小时`;
}

/**
 * 格式化日期时间
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (days === 1) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }
}

/**
 * 生成 Todoist 格式
 */
export function generateTodoistFormat(content: string, category: Category): string {
  const categoryTag = {
    inspiration: '@灵感',
    work: '@工作',
    personal: '@个人',
    article: '@待看',
    other: '@其他',
  }[category];

  return `[- ] ${content}\n${categoryTag}`;
}

/**
 * 生成 Notion 格式
 */
export function generateNotionFormat(content: string, category: Category, source?: string): string {
  const tags = {
    inspiration: '#灵感',
    work: '#工作',
    personal: '#个人',
    article: '#待看',
    other: '#其他',
  }[category];

  let result = `# ${content}\n标签: ${tags}\n`;

  if (source) {
    result += `来源: ${source}\n`;
  }

  result += `---`;

  return result;
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

/**
 * 从 URL 提取域名
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * 检测是否为 URL
 */
export function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 视觉进度条 - 根据剩余时间返回字符数量
 */
export function getProgressBars(urgency: Urgency): string {
  const bars = {
    normal: '║═════════════════',
    warning: '║═══════════║',
    alert: '║══════║',
    urgent: '║║',
  };
  return bars[urgency];
}

/**
 * 获取状态对应的颜色类
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'text-gray-600 dark:text-gray-400',
    cooked: 'text-green-600 dark:text-green-400',
    todo: 'text-blue-600 dark:text-blue-400',
    frozen: 'text-cyan-600 dark:text-cyan-400',
    composted: 'text-gray-400 dark:text-gray-600',
    expired: 'text-red-600 dark:text-red-400',
  };
  return colors[status] || '';
}
