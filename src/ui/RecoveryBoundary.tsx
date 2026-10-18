import { Component, type ReactNode, type ErrorInfo } from 'react';
import { t } from '../platform/i18n';
import { gameStore } from '../platform/store';
import { SaveRecovery } from './SaveRecovery';

export class RecoveryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Never write a possibly damaged in-memory state over the original after a render failure.
    gameStore.rendererReady = false;
    gameStore.paused = true;
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="runtime-recovery" role="alert">
        <section>
          <h1>{t('화면을 다시 준비해야 합니다')}</h1>
          <p>{t('저장 원본은 유지됩니다. 새로고침하거나 원본을 내보내 보관하세요.')}</p>
          <button className="primary" onClick={() => window.location.reload()}>
            {t('새로고침')}
          </button>
          <SaveRecovery busy={false} onRecovered={() => window.location.reload()} />
        </section>
      </main>
    );
  }
}
