import { t } from '../platform/i18n';
import { useRef, type ReactNode } from 'react';
import type { ArtId } from '../domain/model';
import { Icon } from './Icons';
import { PaintedSprite } from './PaintedSprite';
import { useDialogLayer } from './dialog-layer';
export function ArtGlyph({ id }: { id?: ArtId }) {
  const legacy = { huashan: 7, wudang: 8, tianmo: 9, samja: 10 };
  const added = { tang: 0, shaolin: 1, gaebang: 2, jegal: 3 };
  return id && id in added ? (
    <PaintedSprite
      sheet="newArts"
      index={added[id as keyof typeof added]}
      className={`art-glyph ${id}`}
    />
  ) : (
    <PaintedSprite
      index={id ? legacy[id as keyof typeof legacy] : 11}
      className={`art-glyph ${id ?? 'untrained'}`}
    />
  );
}
export function Meter({
  value,
  max,
  kind = 'health',
}: {
  value: number;
  max: number;
  kind?: string;
}) {
  return (
    <div
      className={`meter ${kind}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
    >
      <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = '',
  returnFocusTo,
  headerActions,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  className?: string;
  returnFocusTo?: HTMLElement | null;
  headerActions?: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogLayer(ref, returnFocusTo);
  return (
    <div className="scrim">
      <section
        ref={ref}
        className={`dialog ${wide ? 'wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && onClose) {
            e.stopPropagation();
            onClose();
          }
          if (e.key !== 'Tab') return;
          e.stopPropagation();
          const scope =
            ref.current?.querySelector<HTMLElement>('[role="alertdialog"]') ?? ref.current;
          const controls = Array.from(
            scope?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input,select,[tabindex="0"]',
            ) ?? [],
          ).filter((control) => control.getClientRects().length > 0);
          const first = controls[0],
            last = controls[controls.length - 1];
          if (!controls.length) {
            e.preventDefault();
            scope?.focus();
          } else if (!controls.includes(document.activeElement as HTMLElement)) {
            e.preventDefault();
            (e.shiftKey ? last : first)?.focus();
          } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="dialog-header">
          <h2>
            <PaintedSprite index={12} className="dialog-seal" />
            {title}
          </h2>
          {headerActions}
          {onClose && (
            <button onClick={onClose} aria-label={t('{0} 닫기', { 0: title })}>
              {t('닫기 ')}
              <Icon name="close" />
            </button>
          )}
        </header>
        {children}
      </section>
    </div>
  );
}
export function Confirmation({
  title,
  children,
  onClose,
  returnFocusTo,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogLayer(ref, returnFocusTo);
  return (
    <div
      ref={ref}
      className="confirm-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}
export function lifespan(expiresAt?: number) {
  if (!expiresAt) return t('강호 입문 중');
  const hours = Math.max(0, Math.ceil((expiresAt - Date.now()) / 3600000));
  return t('{0}일 {1}시간', { 0: Math.floor(hours / 24), 1: hours % 24 });
}
