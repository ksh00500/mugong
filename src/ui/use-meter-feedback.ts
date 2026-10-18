import { useLayoutEffect, useRef } from 'react';
import { HealthTrail } from '../game/health-trail';

/** Animate the two paint layers only while needed; never rerender the HUD at 60Hz. */
export function useMeterFeedback(value: number, max: number, identity: string, enabled: boolean) {
  const element = useRef<HTMLDivElement>(null),
    model = useRef<HealthTrail | null>(null);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node || !enabled) return;
    const trail = (model.current ??= new HealthTrail());
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    trail.update(value, max, performance.now() / 1000, identity);
    const paint = () => {
      const sample = trail.sample(performance.now() / 1000, media.matches);
      node.style.setProperty('--meter-trail', String(sample.trail));
      node.dataset.feedback = sample.phase;
      node.dataset.health = sample.level;
      if (sample.active) frame = requestAnimationFrame(paint);
    };
    const changed = () => {
      cancelAnimationFrame(frame);
      paint();
    };
    paint();
    media.addEventListener('change', changed);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener('change', changed);
    };
  }, [value, max, identity, enabled]);
  return element;
}
