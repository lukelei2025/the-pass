import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import ListItem from '../components/ListItem';
import { useTranslation } from '../hooks/useTranslation';
import { useFilters } from '../hooks/useFilters';
import SearchBar from '../components/ui/SearchBar';
import { CategoryFilterPills, SourceFilterPills, ClearFiltersButton } from '../components/ui/FilterPills';

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
    filteredItems,
    availableCategories,
    availableSources,
    hasActiveFilters,
    setSearchQuery,
    toggleCategory,
    toggleSource,
    clearAllFilters,
  } = useFilters(frozenItems);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
        <h2 className="text-[20px] font-semibold text-[var(--color-ink)]">{t.freezer.title}</h2>
        <span className="text-[13px] font-medium text-[var(--color-ink-secondary)]">
          {filteredItems.length}{hasActiveFilters ? ` / ${frozenItems.length}` : ''} items
        </span>
      </div>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search stowed items..."
      />

      {/* Filters */}
      {(availableCategories.length > 0 || availableSources.length > 0) && (
        <div className="space-y-2">
          <CategoryFilterPills
            categories={availableCategories}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            getCategoryLabel={(cat) => t.categories[cat]}
          />

          <SourceFilterPills
            sources={availableSources}
            selectedSources={selectedSources}
            onToggleSource={toggleSource}
          />

          {hasActiveFilters && (
            <ClearFiltersButton onClick={clearAllFilters}>
              Clear all filters
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
