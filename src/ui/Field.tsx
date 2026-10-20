import { useEffect, useRef, useState } from 'react';
import { gameStore } from '../platform/store';
import { COMBAT_IMAGES, type ImageProgress } from '../platform/assets';
import { prepareCombat, CombatPreparationError } from '../platform/game-loader';
import { LoadingScreen, type LoadingFailure } from './LoadingScreen';

export function Field({ onReadyChange }: { onReadyChange: (ready: boolean) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [failure, setFailure] = useState<LoadingFailure>('images');
  const [regionProgress, setRegionProgress] = useState<ImageProgress | null>(null);
  const ready = status === 'ready' && regionProgress === null;
  const [progress, setProgress] = useState<ImageProgress>({
    completed: 0,
    total: Object.keys(COMBAT_IMAGES).length,
  });
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let phase: LoadingFailure = 'images';
    setStatus('loading');
    setRegionProgress(null);
    onReadyChange(false);
    gameStore.rendererReady = false;
    const timeout = window.setTimeout(() => fail(), 65000);
    function fail(reason: LoadingFailure = phase) {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeout);
      gameStore.rendererReady = false;
      onReadyChange(false);
      cleanup?.();
      cleanup = undefined;
      setStatus('error');
      setFailure(reason);
      setRegionProgress(null);
    }
    void prepareCombat((value) => {
      if (!cancelled) {
        setProgress(value);
        phase = value.stage === 'engine' ? 'engine' : 'images';
      }
    })
      .then(async ({ mountGame, images }) => {
        if (cancelled || !root.current) return;
        phase = 'scene';
        setProgress({
          completed: Object.keys(images).length,
          total: Object.keys(images).length,
          stage: 'scene',
        });
        // Let React paint the real initialization stage before synchronous texture upload.
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, 100);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              clearTimeout(timer);
              resolve();
            }),
          );
        });
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
          (reason) => fail(reason),
          (value) => {
            if (cancelled) return;
            setRegionProgress(value);
            onReadyChange(value === null);
          },
        );
      })
      .catch((error) => fail(error instanceof CombatPreparationError ? error.stage : phase));
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
          failure={failure}
          onRetry={() => {
            // Browsers cache failed ES module imports for the lifetime of a document.
            if (failure === 'engine') window.location.reload();
            else setAttempt((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
