import type { Category, CategoryInfo, Urgency } from '../types';

/**
 * 分类信息映射
 */
/**
 * 兼容旧数据的分类映射
 */
export function mapCategory(cat: string): Category {
  const map: Record<string, Category> = {
    'inspiration': 'ideas',
    'idea': 'ideas',
    'ideas': 'ideas',
    'work': 'work',
    'personal': 'personal',
    'article': 'external',
    'external': 'external',
    'other': 'others',
    'others': 'others',
  };
  return map[cat.toLowerCase()] || 'others';
}

/**
 * 分类信息映射
 */
export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  ideas: {
    id: 'ideas',
    name: 'Ideas',
    icon: '💡',
    color: 'cat-dot-inspiration', // Reuse existing color class or rename in CSS? Assuming class exists
  },
  work: {
    id: 'work',
    name: 'Work',
    icon: '💼',
    color: 'cat-dot-work',
  },
  personal: {
    id: 'personal',
    name: 'Personal',
    icon: '🏠',
    color: 'cat-dot-personal',
  },
  external: {
    id: 'external',
    name: 'External',
    icon: '🔗', // or 📰
    color: 'cat-dot-article',
  },
  others: {
    id: 'others',
    name: 'Others',
    icon: '📝',
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
  if (hours === 0 && minutes === 0) return 'Expired';
  if (hours === 0) return `${minutes}m left`;
  if (hours < 24) return `${hours}h ${minutes}m left`;
  return `${hours}h left`;
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
    return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  } else if (days === 1) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * 生成 Todoist 格式
 */
export function generateTodoistFormat(content: string, category: Category): string {
  const categoryTag = {
    ideas: '@Ideas',
    work: '@Work',
    personal: '@Personal',
    external: '@External',
    others: '@Others',
  }[category];

  return `[- ] ${content}\n${categoryTag}`;
}

/**
 * 生成 Notion 格式
 */
export function generateNotionFormat(content: string, category: Category, source?: string): string {
  const tags = {
    ideas: '#Ideas',
    work: '#Work',
    personal: '#Personal',
    external: '#External',
    others: '#Others',
  }[category];

  let result = `# ${content}\nTags: ${tags}\n`;

  if (source) {
    result += `Source: ${source}\n`;
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
