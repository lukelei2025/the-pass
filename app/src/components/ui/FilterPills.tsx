import { type HTMLAttributes } from 'react';
import type { Category } from '../../types';
import { getCategoryPillStyle } from '../../lib/styles/categoryStyles';
import { cn } from '../../lib/utils';

interface FilterPillProps extends HTMLAttributes<HTMLButtonElement> {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * 单个筛选 Pill 按钮
 */
function FilterPill({ selected, onClick, children, className, ...props }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-[12px] font-semibold transition-all duration-150 cursor-pointer',
        selected
          ? 'bg-[var(--color-ink)] text-white'
          : 'bg-[rgba(0,0,0,0.04)] text-[var(--color-ink-secondary)] hover:bg-[rgba(0,0,0,0.08)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

interface CategoryFilterPillsProps {
  categories: Category[];
  selectedCategories: Set<Category>;
  onToggleCategory: (category: Category) => void;
  getCategoryLabel: (category: Category) => string;
  className?: string;
}

/**
 * 分类筛选 Pills 组件
 *
 * @example
 * ```tsx
 * <CategoryFilterPills
 *   categories={availableCategories}
 *   selectedCategories={selectedCategories}
 *   onToggleCategory={toggleCategory}
 *   getCategoryLabel={(cat) => t.categories[cat]}
 * />
 * ```
 */
export function CategoryFilterPills({
  categories,
  selectedCategories,
  onToggleCategory,
  getCategoryLabel,
  className,
}: CategoryFilterPillsProps) {
  if (categories.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onToggleCategory(category)}
          className={cn(
            'px-3 py-1 rounded-full text-[12px] font-semibold transition-all duration-150 cursor-pointer',
            getCategoryPillStyle(category, selectedCategories.has(category))
          )}
        >
          {getCategoryLabel(category)}
        </button>
      ))}
    </div>
  );
}

interface SourceFilterPillsProps {
  sources: string[];
  selectedSources: Set<string>;
  onToggleSource: (source: string) => void;
  className?: string;
}

/**
 * 平台标签筛选 Pills 组件
 *
 * @example
 * ```tsx
 * <SourceFilterPills
 *   sources={availableSources}
 *   selectedSources={selectedSources}
 *   onToggleSource={toggleSource}
 * />
 * ```
 */
export function SourceFilterPills({
  sources,
  selectedSources,
  onToggleSource,
  className,
}: SourceFilterPillsProps) {
  if (sources.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {sources.map((source) => (
        <FilterPill
          key={source}
          selected={selectedSources.has(source)}
          onClick={() => onToggleSource(source)}
        >
          {source}
        </FilterPill>
      ))}
    </div>
  );
}

interface ClearFiltersButtonProps extends HTMLAttributes<HTMLButtonElement> {
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * 清除筛选按钮
 */
export function ClearFiltersButton({ onClick, children, className, ...props }: ClearFiltersButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn('text-[12px] text-[var(--color-accent)] hover:text-[#0077ED] font-medium transition-colors', className)}
      {...props}
    >
      {children}
    </button>
  );
}

export default FilterPill;
