import { type HTMLAttributes } from 'react';
import type { Category } from '../../types';
import { getCategoryTagStyle } from '../../lib/styles/categoryStyles';
import { cn } from '../../lib/utils';

interface CategoryTagProps extends HTMLAttributes<HTMLSpanElement> {
  category: Category;
  label?: string;
}

/**
 * 分类标签组件
 * 用于显示卡片上的分类标签
 *
 * @example
 * ```tsx
 * <CategoryTag category="ideas" />
 * <CategoryTag category="work" label="Custom Label" />
 * ```
 */
export default function CategoryTag({
  category,
  label,
  className,
  ...props
}: CategoryTagProps) {
  const styleClass = getCategoryTagStyle(category);

  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
        styleClass,
        className
      )}
      {...props}
    >
      {label}
    </span>
  );
}
