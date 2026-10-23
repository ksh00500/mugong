import type Phaser from 'phaser';
import type { Run } from '../domain/model';
import { isBossEnemy } from '../domain/boss-resilience';
import { bossAttackTell } from './boss-tells';
import { bossOpening } from '../domain/boss-recovery';
const colors = {
  sweep: 0xefb76d,
  thrust: 0xf4c985,
  dash: 0xff9875,
  projectile: 0xd6c7ff,
  field: 0xd4a8ec,
  cast: 0x9fd5c1,
};
/** HP-adjacent readiness/opening marks only; no ground range or landing previews. */
export class BossReadability {
  private marks: Phaser.GameObjects.Graphics;
  constructor(
    scene: Phaser.Scene,
    private bar: (id: number) => { y: number } | undefined,
  ) {
    this.marks = scene.add.graphics().setDepth(5001);
  }
  draw(run: Run | null, _time: number, _reduced: boolean) {
    this.marks.clear();
    if (!run || run.phase !== 'combat') return;
    for (const e of run.enemies) {
      if (!isBossEnemy(e) || e.hp <= 0) continue;
      const opening = bossOpening(e),
        bar = this.bar(e.id),
        g = this.marks;
      if (opening && bar) {
        g.lineStyle(2, 0xa9ebc4, 0.9)
          .lineBetween(e.x - 27, bar.y + 8, e.x - 27, bar.y + 14)
          .lineBetween(e.x + 27, bar.y + 8, e.x + 27, bar.y + 14);
        g.fillStyle(0xa9ebc4, 0.85).fillRect(
          e.x - 22,
          bar.y + 10,
          44 * Math.min(1, opening.remaining / opening.duration),
          3,
        );
      }
      const tell = bossAttackTell(e);
      if (tell && bar)
        for (let i = 0; i < 4; i++)
          g.fillStyle(colors[tell.kind], tell.progress > i / 4 ? 0.9 : 0.22).fillRect(
            e.x - 22 + i * 12,
            bar.y + 8,
            9,
            3,
          );
    }
  }
  destroy() {
    this.marks.destroy();
  }
}
