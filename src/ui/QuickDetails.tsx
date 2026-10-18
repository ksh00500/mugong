import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ARTS } from '../domain/content';
import type { ArtId, Fighter } from '../domain/model';
import { milestoneGain, supportEffects } from '../domain/support';
import { techniqueCopy } from '../platform/game-copy';
import { t, useLanguage } from '../platform/i18n';
import { ArtGlyph } from './shared';

/** One non-modal preview in the active surface; never pauses combat or changes selection. */
export function QuickDetails({
  scope,
  fighter,
}: {
  scope: RefObject<HTMLElement | null>;
  fighter?: Fighter;
}) {
  const id = useId();
  const { locale } = useLanguage();
  const panel = useRef<HTMLElement>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const dismiss = useRef<() => void>(() => {});
  const [details, setDetails] = useState<{
    art: ArtId;
    level: number;
    next: boolean;
    interactive: boolean;
  } | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const held = useRef(false),
    pinned = useRef(false),
    hovered = useRef(false),
    focused = useRef(false);
  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    let keyboardFocus = false;
    let hoverTarget: HTMLElement | undefined;
    const visible = (element: HTMLElement) =>
      !!element.getClientRects().length && !element.closest('[hidden],[inert]');
    const active = () => visible(root);
    function close() {
      anchor.current?.removeAttribute('aria-describedby');
      anchor.current = null;
      root
        ?.querySelectorAll('[data-details-toggle]')
        .forEach((button) => button.setAttribute('aria-expanded', 'false'));
      setDetails(null);
    }
    function target(element?: EventTarget | null) {
      const candidate =
        element instanceof Element ? element.closest<HTMLElement>('[data-technique]') : null;
      if (candidate && root?.contains(candidate) && visible(candidate)) return candidate;
      const elements = [...root!.querySelectorAll<HTMLElement>('[data-technique]')].filter(visible);
      return (
        elements.find((element) => element.getAttribute('aria-pressed') === 'true') ?? elements[0]
      );
    }
    function show(element?: HTMLElement) {
      if (!element || !active()) return;
      const art = element.dataset.technique as ArtId;
      if (!ARTS[art]) return;
      anchor.current?.removeAttribute('aria-describedby');
      anchor.current = element;
      element.setAttribute('aria-describedby', id);
      setDetails({
        art,
        level: Number(element.dataset.level) || 1,
        next: element.dataset.next === 'true',
        interactive: held.current || pinned.current,
      });
    }
    function leave() {
      if (!held.current && !pinned.current) close();
    }
    const over = (event: PointerEvent) => {
      if (panel.current?.contains(event.target as Node)) {
        hovered.current = true;
        return;
      }
      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-technique]')
          : null;
      if (!element || element.contains(event.relatedTarget as Node | null)) return;
      hovered.current = true;
      hoverTarget = element;
      if (held.current) show(element);
    };
    const out = (event: PointerEvent) => {
      const element =
        event.target instanceof Element
          ? event.target.closest('[data-technique],.quick-details')
          : null;
      if (!element || element.contains(event.relatedTarget as Node | null)) return;
      hovered.current = false;
      leave();
    };
    const focus = (event: FocusEvent) => {
      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-technique]')
          : null;
      focused.current = !!element && keyboardFocus;
      if (focused.current && held.current) show(element!);
      else leave();
    };
    const blur = () => {
      focused.current = false;
      leave();
    };
    const down = (event: KeyboardEvent) => {
      if (
        !active() ||
        (event.target instanceof Element &&
          event.target.closest('input,select,textarea,[contenteditable="true"]'))
      )
        return;
      if (event.key === 'Tab') keyboardFocus = true;
      if (
        event.key === 'Enter' &&
        event.target instanceof HTMLElement &&
        event.target.matches('[data-technique]:not(button)')
      ) {
        event.preventDefault();
        toggle(event.target);
      }
      if (
        event.key === 'Shift' &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        held.current = true;
        show(target(hovered.current ? hoverTarget : document.activeElement));
      }
      if (event.key === 'Escape' && anchor.current) {
        held.current = pinned.current = hovered.current = focused.current = false;
        close();
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        held.current = false;
        if (pinned.current)
          setDetails((current) => (current ? { ...current, interactive: true } : null));
        else close();
      }
    };
    const toggle = (element?: HTMLElement) => {
      if (pinned.current && anchor.current === element) {
        pinned.current = false;
        close();
      } else {
        pinned.current = true;
        show(element);
      }
    };
    const click = (event: MouseEvent) => {
      const button =
        event.target instanceof Element ? event.target.closest('[data-details-toggle]') : null;
      if (button) {
        toggle(target(document.activeElement));
        button.setAttribute('aria-expanded', String(pinned.current));
        return;
      }
      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-technique]:not(button)')
          : null;
      if (!element || (event.target instanceof Element && event.target.closest('button'))) return;
      element.focus();
      toggle(element);
    };
    const reset = () => {
      held.current = pinned.current = hovered.current = focused.current = false;
      close();
    };
    dismiss.current = reset;
    const visibility = new MutationObserver((records) => {
      if (
        !active() ||
        (anchor.current && (!anchor.current.isConnected || !visible(anchor.current)))
      )
        reset();
      else if (
        held.current &&
        !hovered.current &&
        !pinned.current &&
        records.some(
          (record) =>
            ['aria-pressed', 'data-level', 'data-next'].includes(record.attributeName ?? '') &&
            root.contains(record.target),
        )
      ) {
        show(target(focused.current ? document.activeElement : undefined));
      }
    });
    visibility.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['inert', 'hidden', 'aria-pressed', 'data-level', 'data-next'],
    });
    const pointerDown = () => {
      keyboardFocus = false;
    };
    root.addEventListener('pointerover', over);
    root.addEventListener('pointerout', out);
    root.addEventListener('focusin', focus);
    root.addEventListener('focusout', blur);
    root.addEventListener('click', click);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', reset);
    window.addEventListener('pointerdown', pointerDown, true);
    return () => {
      visibility.disconnect();
      dismiss.current = () => {};
      anchor.current?.removeAttribute('aria-describedby');
      root.removeEventListener('pointerover', over);
      root.removeEventListener('pointerout', out);
      root.removeEventListener('focusin', focus);
      root.removeEventListener('focusout', blur);
      root.removeEventListener('click', click);
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', reset);
      window.removeEventListener('pointerdown', pointerDown, true);
    };
  }, [scope, id]);
  useLayoutEffect(() => {
    if (!details) return;
    const place = () => {
      const trigger = anchor.current,
        popup = panel.current;
      if (
        !trigger ||
        !popup ||
        !trigger.getClientRects().length ||
        trigger.closest('[inert],[hidden]')
      ) {
        dismiss.current();
        return;
      }
      const rect = trigger.getBoundingClientRect(),
        bounds = popup.getBoundingClientRect();
      const above = rect.top - bounds.height - 12;
      const side =
        !details.next && above < 12 && rect.bottom + bounds.height + 12 > innerHeight
          ? rect.left - bounds.width - 12 >= 12
            ? rect.left - bounds.width - 12
            : rect.right + bounds.width + 12 <= innerWidth
              ? rect.right + 12
              : null
          : null;
      setPosition({
        left: Math.max(
          12,
          Math.min(
            innerWidth - bounds.width - 12,
            side ?? rect.left + (rect.width - bounds.width) / 2,
          ),
        ),
        top: Math.max(
          12,
          Math.min(
            innerHeight - bounds.height - 12,
            side !== null
              ? rect.top
              : above >= 12
                ? above
                : rect.bottom + bounds.height + 12 <= innerHeight
                  ? rect.bottom + 12
                  : 12,
          ),
        ),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [details, locale]);
  if (!details) return null;
  const definition = ARTS[details.art],
    preview =
      fighter && details.next
        ? {
            ...fighter,
            arts: [
              ...fighter.arts.filter((a) => a.id !== details.art),
              {
                id: details.art,
                level: details.level,
                gauge: 0,
                combo: 0,
                defenseCd: 0,
              },
            ],
          }
        : fighter,
    copy = techniqueCopy(details.art, details.level, preview),
    supports = supportEffects(details.art, details.level);
  return (
    <aside
      ref={panel}
      id={id}
      role="tooltip"
      className="quick-details"
      data-interactive={details.interactive}
      style={position}
    >
      <header>
        <ArtGlyph id={details.art} />
        <div>
          <small>{t(details.next ? '선택 후 효과' : '현재 무공')}</small>
          <h3>
            {t(definition.name)} <span>Lv.{details.level}</span>
          </h3>
        </div>
      </header>
      <p>{copy.description}</p>
      {details.next && (
        <strong className="quick-details-gain">
          {t(milestoneGain(details.art, details.level, definition.stages[details.level - 1]))}
        </strong>
      )}
      <dl>
        <dt>{t('기본 공격')}</dt>
        <dd>
          {copy.attack}
          {copy.extra && <small>{copy.extra}</small>}
          {copy.healing && <small>{copy.healing}</small>}
          {copy.advanced && <small>{copy.advanced}</small>}
        </dd>
        <dt>
          <kbd>Space</kbd>
        </dt>
        <dd>
          {copy.defense}
          <small>{copy.cooldown}</small>
        </dd>
        <dt>{t('우클릭')}</dt>
        <dd>
          {copy.ultimate}
          {copy.ultimateExtra && <small>{copy.ultimateExtra}</small>}
        </dd>
      </dl>
      {!!supports.length && (
        <section className="quick-details-support" aria-label={t('보조 효과')}>
          <b>{t('보조 효과')}</b>
          {supports.map((effect) => (
            <small key={effect.level}>
              {t('{0}성 · {1}', { 0: effect.level, 1: t(effect.description) })}
            </small>
          ))}
        </section>
      )}
      <footer>
        <small>{t('2성·4성 보조 효과는 배운 모든 무공에 함께 적용됩니다.')}</small>
        {t('무장 가방의 호환 무기를 연결해 사용합니다.')}
        {details.next && details.level === 1 && (
          <small>{t('입문 시 필요한 수련 무장을 함께 받습니다.')}</small>
        )}
        <small>{t('Esc로 닫기')}</small>
      </footer>
    </aside>
  );
}
