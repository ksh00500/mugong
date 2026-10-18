import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t, useLanguage } from '../platform/i18n';

export const ABILITY_INFO = [
  {
    key: 'constitution',
    name: '체질',
    abbreviation: 'CON',
    description: '체질은 최대 체력을 높입니다.',
  },
  {
    key: 'strength',
    name: '근력',
    abbreviation: 'STR',
    description: '근력은 기본 공격의 피해를 높입니다.',
  },
  {
    key: 'agility',
    name: '기민',
    abbreviation: 'AGI',
    description: '기민은 이동 속도를 높이고 방어 행동의 재사용 시간을 줄입니다.',
  },
  {
    key: 'inner',
    name: '내공',
    abbreviation: 'QI',
    description: '내공은 궁극 피해와 궁극 충전량을 높입니다.',
  },
] as const;

/** Keep explanations in the active dialog, without opening another modal. */
export function InfoPrefix({
  icon,
  artwork,
  label,
  description,
  children,
}: {
  icon?: string;
  artwork?: ReactNode;
  label: string;
  description: string;
  children?: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const { locale } = useLanguage();
  const show = () => {
    setContainer(trigger.current?.closest<HTMLElement>('[role="dialog"]') ?? null);
    window.dispatchEvent(new CustomEvent('mugong-character-info', { detail: id }));
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open || !container || !trigger.current || !popup.current) return;
    const place = () => {
      const anchor = trigger.current!.getBoundingClientRect(),
        scope = container.getBoundingClientRect(),
        tip = popup.current!.getBoundingClientRect();
      const left = Math.max(
        Math.max(8, scope.left + 8),
        Math.min(Math.min(innerWidth, scope.right) - tip.width - 8, anchor.left),
      );
      const above = anchor.top - tip.height - 8;
      const top = Math.max(
        Math.max(8, scope.top + 8),
        Math.min(
          Math.min(innerHeight, scope.bottom) - tip.height - 8,
          above >= scope.top + 8 ? above : anchor.bottom + 8,
        ),
      );
      setPosition({
        left: left - scope.left + container.scrollLeft - container.clientLeft,
        top: top - scope.top + container.scrollTop - container.clientTop,
      });
    };
    place();
    window.addEventListener('resize', place);
    const close = () => setOpen(false);
    const other = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('mugong-character-info', other);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('mugong-character-info', other);
    };
  }, [open, container, locale, description, id]);
  return (
    <span className="character-info-prefix">
      <button
        ref={trigger}
        type="button"
        className="character-info-icon"
        aria-label={t('{0} 설명', { 0: label })}
        aria-describedby={open ? id : undefined}
        onPointerEnter={show}
        onPointerLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          show();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {artwork ?? <img src={icon} alt="" width={24} height={24} decoding="async" />}
      </button>
      {children}
      {open &&
        container &&
        createPortal(
          <span
            ref={popup}
            id={id}
            role="tooltip"
            className="character-info-tooltip"
            style={position}
          >
            <strong>{label}</strong>
            <span>{description}</span>
          </span>,
          container,
        )}
    </span>
  );
}

export const characterInfoIcon = (id: string) => `/art/character-info-v1/${id}.webp`;
