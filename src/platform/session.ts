let held = false;
let release: (() => void) | undefined;
export async function claimSession(): Promise<boolean> {
  if (held) return true;
  if (!navigator.locks)
    throw new Error('이 브라우저는 안전한 저장 잠금을 지원하지 않습니다. 최신 Chrome 또는 Edge에서 실행하세요.');
  return new Promise((resolve, reject) => {
    void navigator.locks
      .request('mugong-single-writer', { ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve(false);
          return;
        }
        held = true;
        resolve(true);
        await new Promise<void>((done) => {
          release = done;
        });
      })
      .catch(reject);
  });
}
window.addEventListener('pagehide', (event: PageTransitionEvent) => {
  // A cached document can resume with its existing store. Keep its writer lease.
  if (event.persisted) return;
  release?.();
  held = false;
});
