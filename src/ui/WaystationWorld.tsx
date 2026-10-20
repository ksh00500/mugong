import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { View } from '../platform/store';
import { gameStore } from '../platform/store';
import { nearestWaystationStop, WAYSTATION_STOPS } from '../domain/waystation';
import { regionName } from '../domain/campaign';
import { t } from '../platform/i18n';
import { PrepStop } from './PrepStop';
import { RestMarket } from './RestMarket';
import { Modal } from './shared';

export function WaystationWorld({
  view,
  onNext,
  hidden,
}: {
  view: View;
  onNext: () => void;
  hidden: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const [plane, setPlane] = useState<CSSProperties>({});
  const run = view.state.run!;
  const near = nearestWaystationStop(run.fighter);
  const conversation = view.waystationDialogue;
  useLayoutEffect(() => {
    const canvas = document.querySelector('.game-canvas canvas');
    const frame = root.current?.parentElement;
    if (!canvas || !frame) return;
    const measure = () => {
      const b = canvas.getBoundingClientRect(),
        p = frame.getBoundingClientRect();
      setPlane({ left: b.left - p.left, top: b.top - p.top, width: b.width, height: b.height });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(canvas);
    resize.observe(frame);
    return () => resize.disconnect();
  }, []);
  const ready = !view.busy && !view.paused && !view.error && !view.bagOpen;
  return (
    <>
      <section
        ref={root}
        className="waystation-world"
        data-player-x={Math.round(run.fighter.x)}
        data-player-y={Math.round(run.fighter.y)}
        data-player-action={run.fighter.action}
        data-elapsed={run.elapsed}
        hidden={hidden || !!conversation}
        aria-label={t('강호 쉼터')}
      >
        <header className="waystation-heading">
          <div>
            <small>
              {t(regionName(run))} · {t('{0}웨이브', { 0: run.wave })}
            </small>
            <h1>{t('강호 쉼터')}</h1>
          </div>
          <b>{t('소지금 {0}전', { 0: run.gold })}</b>
        </header>
        <div className="waystation-plane" style={plane}>
          {WAYSTATION_STOPS.map((stop) => (
            <button
              key={stop.id}
              data-stop={stop.id}
              data-near={near?.id === stop.id}
              className="waystation-marker"
              disabled={!ready}
              style={{
                left: `${(stop.x / 1920) * 100}%`,
                top: `${((stop.y + (stop.id === 'exit' ? 35 : -185)) / 1080) * 100}%`,
              }}
              onClick={() => gameStore.approachWaystation(stop.id)}
              aria-label={
                near?.id === stop.id
                  ? t('{0} · 상호작용', { 0: t(stop.name) })
                  : t('{0}에게 이동', { 0: t(stop.name) })
              }
            >
              {t(stop.name)}
              <small>
                {t(
                  near?.id === stop.id
                    ? 'E · 상호작용'
                    : view.waystationTarget === stop.id
                      ? '이동 중'
                      : '다가가기',
                )}
              </small>
            </button>
          ))}
        </div>
        <footer className="waystation-controls">
          <p>
            <kbd>WASD</kbd> {t('이동')} · <kbd>E</kbd> {t('상호작용')} · <kbd>I</kbd> {t('가방')}
            <small>{t('이곳에서는 전투와 시간이 멈춥니다.')}</small>
          </p>
          <div role="status" aria-live="polite">
            {view.waystationTarget
              ? t('직접 이동하면 자동 이동을 취소합니다.')
              : near
                ? t('{0} · E로 상호작용하세요.', { 0: t(near.name) })
                : t('인물이나 출구에 다가가세요. 표식을 눌러 이동할 수도 있습니다.')}
          </div>
          <button disabled={!ready} onClick={() => gameStore.openBag(true)}>
            {t('가방과 획득 물품')}
          </button>
        </footer>
      </section>
      {conversation &&
        !hidden &&
        (conversation === 'merchant' ? (
          <RestMarket
            run={run}
            busy={view.busy}
            onClose={() => gameStore.closeWaystation()}
            returnFocusTo={root.current?.querySelector<HTMLElement>('[data-stop="merchant"]')}
          />
        ) : (
          <Modal
            className="waystation-dialog"
            title={t(WAYSTATION_STOPS.find((s) => s.id === conversation)!.name)}
            onClose={() => gameStore.closeWaystation()}
            returnFocusTo={root.current?.querySelector<HTMLElement>(
              `[data-stop="${conversation}"]`,
            )}
          >
            <PrepStop
              run={run}
              busy={view.busy}
              hidden={false}
              station={conversation}
              onMarket={() => {}}
              onNext={onNext}
            />
          </Modal>
        ))}
    </>
  );
}
