import { useTranslation } from '../../hooks/useTranslation';
import type { Category } from '../../types';

interface CategorySelectorProps {
  selectedCategory?: Category;
  onSelect: (category: Category) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function CategorySelector({
  selectedCategory,
  onSelect,
  onCancel,
  disabled = false,
}: CategorySelectorProps) {
  const { t } = useTranslation();

  const categories: Array<{ id: Category; icon: string; label: string }> = [
    { id: 'ideas', icon: '💡', label: t.categories.ideas },
    { id: 'work', icon: '💼', label: t.categories.work },
    { id: 'personal', icon: '🏠', label: t.categories.personal },
    { id: 'external', icon: '🔗', label: t.categories.external },
    { id: 'others', icon: '📝', label: t.categories.others },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-[var(--color-ink-secondary)]">
        {t.categorySelect.prompt}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => !disabled && onSelect(cat.id)}
            disabled={disabled}
            className={`
              flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-200
              ${
                selectedCategory === cat.id
                  ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-ink-tertiary)] hover:bg-[rgba(0,0,0,0.02)]'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-[12px] font-semibold">{cat.label}</span>
          </button>
        ))}
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={disabled}
          className="w-full py-2 text-[12px] font-medium text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)] transition-colors disabled:opacity-50"
        >
          {t.categorySelect.cancel}
        </button>
      )}
    </div>
  );
}
