import type { Category } from '../../types';

/**
 * 分类颜色配置
 * 统一管理所有与分类相关的颜色和样式
 */
export const CATEGORY_COLORS = {
  ideas: {
    bg: 'var(--bg-tag-orange)',
    color: 'var(--color-orange)',
    ring: 'ring-[var(--color-orange)]/30',
    dot: 'cat-dot-inspiration',
  },
  work: {
    bg: 'var(--bg-tag-blue)',
    color: 'var(--color-blue)',
    ring: 'ring-[var(--color-blue)]/30',
    dot: 'cat-dot-work',
  },
  personal: {
    bg: 'var(--bg-tag-green)',
    color: 'var(--color-green)',
    ring: 'ring-[var(--color-green)]/30',
    dot: 'cat-dot-personal',
  },
  external: {
    bg: 'var(--bg-tag-purple)',
    color: 'var(--color-purple)',
    ring: 'ring-[var(--color-purple)]/30',
    dot: 'cat-dot-article',
  },
  others: {
    bg: 'var(--bg-tag-gray)',
    color: 'var(--color-gray)',
    ring: 'ring-[var(--color-gray)]/30',
    dot: 'cat-dot-other',
  },
} as const;

/**
 * 获取分类标签样式（用于卡片）
 *
 * @param category - 分类类型
 * @returns Tailwind CSS 类名字符串
 */
export function getCategoryTagStyle(category: Category): string {
  const colors = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS];
  return `bg-[${colors.bg}] text-[${colors.color}]`;
}

/**
 * 获取分类 Pill 样式（用于筛选器）
 *
 * @param category - 分类类型
 * @param selected - 是否选中
 * @returns Tailwind CSS 类名字符串
 */
export function getCategoryPillStyle(category: Category, selected: boolean): string {
  if (!selected) {
    return 'bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.08)]';
  }

  const colors = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS];
  return `bg-[${colors.bg}] text-[${colors.color}] ring-1 ${colors.ring}`;
}

/**
 * 获取分类圆点样式
 *
 * @param category - 分类类型
 * @returns CSS 类名
 */
export function getCategoryDotClass(category: Category): string {
  return CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS].dot;
}

/**
 * 时间紧迫度颜色配置
 */
export const URGENCY_COLORS = {
  normal: 'bg-[#34C759]',
  warning: 'bg-[#FF9F0A]',
  alert: 'bg-[#FF3B30]',
  urgent: 'bg-[#FF3B30] animate-pulse',
} as const;

/**
 * 获取紧迫度指示器颜色
 *
 * @param urgency - 紧迫度级别
 * @returns Tailwind CSS 类名字符串
 */
export function getUrgencyIndicatorColor(urgency: keyof typeof URGENCY_COLORS): string {
  return URGENCY_COLORS[urgency];
}

/**
 * 状态颜色配置
 */
export const STATUS_COLORS = {
  pending: 'text-gray-600 dark:text-gray-400',
  cooked: 'text-green-600 dark:text-green-400',
  todo: 'text-blue-600 dark:text-blue-400',
  frozen: 'text-cyan-600 dark:text-cyan-400',
  composted: 'text-gray-400 dark:text-gray-600',
  expired: 'text-red-600 dark:text-red-400',
} as const;

/**
 * 获取状态颜色
 *
 * @param status - 卡片状态
 * @returns Tailwind CSS 类名字符串
 */
export function getStatusColor(status: keyof typeof STATUS_COLORS): string {
  return STATUS_COLORS[status] || '';
}
