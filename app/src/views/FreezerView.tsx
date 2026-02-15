import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import ListItem from '../components/ListItem';
import { useTranslation } from '../hooks/useTranslation';
import { useFilters } from '../hooks/useFilters';
import SearchBar from '../components/ui/SearchBar';
import FilterPill, { ClearFiltersButton } from '../components/ui/FilterPills';
import { getCategoryPillStyle } from '../lib/styles/categoryStyles';
import { exportItemsToCSV } from '../lib/exportCSV';
import { cn } from '../lib/utils';

export default function FreezerView() {
  const { items } = useStore();
  const { t } = useTranslation();

  // 1. 获取所有 frozen 项目，按创建时间倒序
  const frozenItems = useMemo(() =>
    items
      .filter(item => item.status === 'frozen')
      .sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  // 2. 使用 useFilters Hook
  const {
    searchQuery,
    selectedCategories,
    selectedSources,
    selectedTags,
    filteredItems,
    availableCategories,
    availableSources,
    availableTags,
    hasActiveFilters,
    setSearchQuery,
    toggleCategory,
    toggleSource,
    toggleTag,
    clearAllFilters,
  } = useFilters(frozenItems);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
        <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">{t.freezer.title}</h2>
        <div className="flex items-center gap-3">
          {filteredItems.length > 0 && (
            <button
              onClick={() => exportItemsToCSV(filteredItems, t.categories)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t.freezer.exportExcel}
            </button>
          )}
          <span className="text-[13px] font-medium text-[var(--color-ink-secondary)]">
            {filteredItems.length}{hasActiveFilters ? ` / ${frozenItems.length}` : ''} items
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search stowed items..."
      />

      {/* Filters */}
      {(availableCategories.length > 0 || availableSources.length > 0 || availableTags.length > 0) && (
        <div className="flex flex-wrap gap-2 items-center">
          {/* Categories */}
          {availableCategories.map((category) => (
            <button
              key={category}
              onClick={() => toggleCategory(category)}
              className={cn(
                'px-3 py-1 rounded-full text-[12px] font-semibold transition-all duration-150 cursor-pointer',
                getCategoryPillStyle(category, selectedCategories.has(category))
              )}
            >
              {t.categories[category]}
            </button>
          ))}

          {/* Sources */}
          {availableSources.map((source) => (
            <FilterPill
              key={source}
              selected={selectedSources.has(source)}
              onClick={() => toggleSource(source)}
            >
              {source}
            </FilterPill>
          ))}

          {/* Custom Tags */}
          {availableTags.map((tag) => (
            <FilterPill
              key={`tag-${tag}`}
              selected={selectedTags.has(tag)}
              onClick={() => toggleTag(tag)}
              className={cn(
                selectedTags.has(tag)
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-accent)] bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10'
              )}
            >
              #{tag}
            </FilterPill>
          ))}

          {hasActiveFilters && (
            <ClearFiltersButton onClick={clearAllFilters}>
              Clear all checks
            </ClearFiltersButton>
          )}
        </div>
      )}

      {/* Unified List View (No Grouping) */}
      {filteredItems.length > 0 ? (
        <div className="border border-[var(--color-border)] rounded-[10px] overflow-hidden bg-white shadow-sm">
          {filteredItems.map(item => (
            <ListItem key={item.id} item={item} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-24 opacity-60">
          <div className="w-16 h-16 bg-[rgba(0,0,0,0.03)] rounded-2xl flex items-center justify-center mb-4 text-[var(--color-ink-tertiary)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[var(--color-ink-secondary)]">
            {hasActiveFilters ? 'No matching items' : t.freezer.empty}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="mt-2 text-[13px] text-[var(--color-accent)] hover:text-[#0077ED] font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
