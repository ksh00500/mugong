import { useEffect, useRef, useState } from 'react';
import { gameStore } from '../platform/store';
import { COMBAT_IMAGES, type ImageProgress } from '../platform/assets';
import { prepareCombat } from '../platform/game-loader';
import { LoadingScreen } from './LoadingScreen';

export function Field({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [regionProgress, setRegionProgress] = useState<ImageProgress | null>(null);
  const ready = status === 'ready' && regionProgress === null;
  const [progress, setProgress] = useState<ImageProgress>({
    completed: 0,
    total: Object.keys(COMBAT_IMAGES).length,
  });
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    setStatus('loading');
    setRegionProgress(null);
    onReadyChange(false);
    gameStore.rendererReady = false;
    const timeout = window.setTimeout(() => fail(), 65000);
    function fail() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeout);
      gameStore.rendererReady = false;
      onReadyChange(false);
      cleanup?.();
      cleanup = undefined;
      setStatus('error');
      setRegionProgress(null);
    }
    void prepareCombat((value) => {
      if (!cancelled) setProgress(value);
    })
      .then(({ mountGame, images }) => {
        if (cancelled || !root.current) return;
        cleanup = mountGame(
          root.current,
          images,
          () => {
            if (cancelled) return;
            clearTimeout(timeout);
            setStatus('ready');
            onReadyChange(true);
          },
          fail,
          (value) => {
            if (cancelled) return;
            setRegionProgress(value);
            onReadyChange(value === null);
          },
        );
      })
      .catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      gameStore.rendererReady = false;
      cleanup?.();
      onReadyChange(false);
    };
  }, [attempt, onReadyChange]);
  useEffect(() => {
    // Simulation starts only after React has revealed the ready game screen.
    gameStore.rendererReady = ready;
  }, [ready]);
  return (
    <>
      <div
        className="game-canvas"
        ref={root}
        data-ready={ready}
        style={{ visibility: ready ? 'visible' : 'hidden' }}
      />
      {!ready && (
        <LoadingScreen
          key={attempt}
          kind="combat"
          progress={regionProgress ?? progress}
          error={status === 'error'}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
    </>
  );
}
