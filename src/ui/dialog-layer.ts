import { useLayoutEffect, useRef, type RefObject } from 'react';

const layers: HTMLElement[] = [];
const previousInert = new Map<HTMLElement, boolean>();
let previousOverflow = '';

function updateLayers() {
  for (const [element, inert] of previousInert) element.inert = inert;
  previousInert.clear();
  const top = layers.at(-1);
  if (!top) return;
  // Follow the active dialog's ancestors, so nested lobby dialogs do not inert themselves.
  for (let branch: HTMLElement = top; branch.parentElement; branch = branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
      previousInert.set(sibling, sibling.inert);
      sibling.inert = true;
    }
    if (branch.parentElement === document.body) break;
  }
}

export function isTopDialog(element: HTMLElement | null) {
  return layers.at(-1) === element;
}

/** Share modal isolation across regular dialogs, growth choices and discard confirmations. */
export function useDialogLayer(
  ref: RefObject<HTMLElement | null>,
  returnFocusTo?: HTMLElement | null,
) {
  const previous = useRef(returnFocusTo ?? (document.activeElement as HTMLElement | null));
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!layers.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    layers.push(element);
    updateLayers();
    const visibleControls = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'input:not(:disabled),select:not(:disabled),button:not(:disabled)',
        ),
      ).filter(
        (control) => control.getClientRects().length && !control.closest('[inert],[hidden]'),
      );
    const first =
      visibleControls().find((control) => control.matches('input,select')) ?? visibleControls()[0];
    (first ?? element).focus();
    const recoverFocus = () => {
      if (!isTopDialog(element)) return;
      const focused = document.activeElement as HTMLElement | null;
      if (
        !focused ||
        !element.contains(focused) ||
        !focused.getClientRects().length ||
        focused.matches(':disabled')
      )
        (visibleControls()[0] ?? element).focus();
    };
    const observer = new MutationObserver(recoverFocus);
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'disabled',
        'hidden',
        'class',
        'data-pane',
        'data-compact',
        'data-mobile-tab',
        'data-active',
      ],
    });
    window.addEventListener('resize', recoverFocus);
    // Loading can replace a background branch after a dialog has already opened.
    // Isolate the new sibling too, without reacting to text updates inside the HUD.
    const isolation = new MutationObserver((records) => {
      if (
        isTopDialog(element) &&
        records.some(
          (record) =>
            record.target instanceof HTMLElement &&
            record.target.contains(element) &&
            [...record.addedNodes, ...record.removedNodes].some(
              (node) => node instanceof HTMLElement,
            ),
        )
      )
        updateLayers();
    });
    isolation.observe(document.body, { childList: true, subtree: true });
    return () => {
      isolation.disconnect();
      observer.disconnect();
      window.removeEventListener('resize', recoverFocus);
      const index = layers.indexOf(element);
      if (index >= 0) layers.splice(index, 1);
      updateLayers();
      if (!layers.length) document.body.style.overflow = previousOverflow;
      // React may reveal the opener later in this same commit (for example a field banner).
      queueMicrotask(() => {
        const target = previous.current;
        if (
          target?.isConnected &&
          target.getClientRects().length &&
          target.matches('button,input,select,textarea,a[href],[tabindex]') &&
          !target.closest('[inert],[hidden]') &&
          !target.matches(':disabled')
        )
          target.focus();
        else {
          const fallback =
            layers.at(-1) ??
            target?.closest('main') ??
            document.querySelector<HTMLElement>('main.field-shell');
          const control = Array.from(
            fallback?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [],
          ).find((button) => button.getClientRects().length && !button.closest('[inert],[hidden]'));
          (control ?? fallback)?.focus();
        }
      });
    };
  }, [ref]);
}
