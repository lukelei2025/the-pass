import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface SearchBarProps extends Omit<HTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showClearButton?: boolean;
}

/**
 * 搜索栏组件
 *
 * @example
 * ```tsx
 * <SearchBar
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   placeholder="Search items..."
 *   showClearButton
 * />
 * ```
 */
export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  showClearButton = true,
  className,
  ...props
}: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Search Icon */}
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-tertiary)] pointer-events-none"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>

      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="macos-input w-full pl-10 pr-10 py-2.5 text-[14px]"
        {...props}
      />

      {/* Clear Button */}
      {showClearButton && value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)] transition-colors"
          aria-label="Clear search"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
