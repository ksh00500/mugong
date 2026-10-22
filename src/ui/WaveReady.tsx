import type { Run } from '../domain/model';
import { t } from '../platform/i18n';
import { Icon } from './Icons';

/** Closing the loot workspace keeps progression available on the field. */
export function WaveReady({
  run,
  busy,
  hidden,
  onBag,
  onNext,
}: {
  run: Run;
  busy: boolean;
  hidden: boolean;
  onBag: () => void;
  onNext: () => void;
}) {
  return (
    <section
      className="wave-ready"
      aria-labelledby="wave-ready-title"
      hidden={hidden}
      onKeyDown={(event) => {
        // Tab navigates these buttons rather than reopening the bag through the field shortcut.
        if (event.key === 'Tab' || event.key === ' ') event.stopPropagation();
      }}
    >
      <h2 id="wave-ready-title">
        {run.wave === 20 ? t('강호 완주') : t('{0}웨이브 완료', { 0: run.wave })}
      </h2>
      <div className="wave-ready-actions">
        <button disabled={busy} onClick={onBag}>
          <Icon name="bag" /> {t('가방')}
        </button>
        <button className="primary" disabled={busy} onClick={onNext}>
          {run.wave === 20 ? t('귀환') : t('다음 {0}웨이브 →', { 0: run.wave + 1 })}
        </button>
      </div>
    </section>
  );
}
