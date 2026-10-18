import { t } from '../platform/i18n';
import { useEffect, useState, type ReactNode } from 'react';

export function PagedItems<T>({
  items,
  renderItem,
  empty,
  label,
  compact = false,
  pageSize,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
  empty: ReactNode;
  label: string;
  compact?: boolean;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(() => capacity(compact));
  useEffect(() => {
    const resize = () => setCount(capacity(compact));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [compact]);
  const perPage = pageSize ?? count;
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, pages - 1);
  return (
    <div className="paged-items" aria-label={label}>
      <div className="paged-item-list" style={{ '--item-count': perPage } as React.CSSProperties}>
        {items.length
          ? items.slice(current * perPage, (current + 1) * perPage).map(renderItem)
          : empty}
      </div>
      {pages > 1 && (
        <div className="item-pagination">
          <button
            aria-label={t('{0} 이전 페이지', { 0: label })}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            ‹
          </button>
          <span aria-live="polite">
            {current + 1} / {pages}
          </span>
          <button
            aria-label={t('{0} 다음 페이지', { 0: label })}
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
function capacity(compact = false) {
  if (compact) return window.innerWidth < 600 ? 2 : 4;
  return window.innerWidth < 600 ? 2 : window.innerWidth < 1200 ? 4 : 6;
}
