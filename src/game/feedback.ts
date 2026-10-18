import type Phaser from 'phaser';
import type { CombatCue } from '../domain/combat';
import { sound } from '../platform/audio';
import { fieldSound, weaponSound } from '../platform/combat-sounds';
import { t } from '../platform/i18n';

type Impact = Extract<CombatCue, { kind: 'impact' }> & { born: number };
type Mark = Extract<CombatCue, { kind: 'defense' }> & { born: number };
type Caption = {
  object: Phaser.GameObjects.Text;
  target: string;
  born: number;
  x: number;
  y: number;
  amount: number;
  duration: number;
};

/** Local recoil and contact feedback only; never freezes the simulation or input. */
export class CombatFeedback {
  private impacts = new Map<number | 'hero', Impact>();
  private marks: Mark[] = [];
  private captions: Caption[] = [];
  contact = -100;
  constructor(private scene: Phaser.Scene) {}

  reset() {
    for (const caption of this.captions) caption.object.destroy();
    this.captions = [];
    this.impacts.clear();
    this.marks = [];
    this.contact = -100;
  }

  receive(cues: CombatCue[], now: number, reducedMotion: boolean) {
    let impact = 0,
      hurt = false,
      counter = false,
      evaded = false,
      blocked = false;
    const seen = new Set<string>();
    for (const cue of cues) {
      if (cue.kind === 'ultimate') {
        sound(cue.art === 'tianmo' ? 'blood-burst' : cue.art === 'tang' ? 'poison-burst' : cue.art === 'gaebang' ? 'brew-splash' : cue.art === 'shaolin' ? 'fist-swing' : 'magic-shot');
      } else if (cue.kind === 'field') {
        const key = `field-${cue.action}`;
        if (!seen.has(key)) sound(fieldSound(cue.action));
        seen.add(key);
      } else if (cue.kind === 'mechanic') {
        sound(cue.action === 'bell' ? 'bell' : cue.action === 'reflect' ? 'block' : cue.action === 'repair' ? 'drone-repair' : cue.action === 'sand' ? 'sand-burst' : 'health-exchange');
      } else if (cue.kind === 'strike') {
        if (cue.friendly) {
          this.contact = now;
          sound(weaponSound(cue.weapon));
        }
      } else if (cue.kind === 'impact') {
        this.impacts.set(cue.target, { ...cue, born: now });
        if (cue.target === 'hero') hurt = true;
        else impact = Math.max(impact, cue.killed ? 1 : 0.65);
        this.caption(
          String(cue.target),
          cue.x,
          cue.y - 108,
          cue.amount,
          now,
          cue.target === 'hero' ? '#ffaf98' : cue.killed ? '#fff0ba' : '#fff5e0',
        );
      } else {
        if (seen.has(cue.action)) continue;
        seen.add(cue.action);
        this.marks.push({ ...cue, born: now });
        counter ||= cue.action === 'counter';
        evaded ||= cue.action === 'evade';
        blocked ||= cue.action === 'block';
        const label = {
          evade: '회피',
          guard: '',
          counter: '반격 성공',
          block: '막아냄',
          leech: '혈기 회복',
        }[cue.action];
        if (label)
          this.caption(`defense-${cue.action}`, cue.x, cue.y - 138, 0, now, '#c8eee2', t(label));
      }
    }
    if (impact) sound('impact', impact);
    if (hurt) {
      sound('hit');
      if (!reducedMotion) this.scene.cameras.main.shake(65, 0.0012);
    }
    if (counter) sound('parry');
    else if (blocked) sound('block');
    else if (evaded) sound('evade');
    this.marks = this.marks.slice(-8);
  }

  private caption(
    target: string,
    x: number,
    y: number,
    amount: number,
    now: number,
    color: string,
    label?: string,
  ) {
    const existing = this.captions.find((c) => c.target === target && now - c.born < 0.09);
    if (existing) {
      existing.amount += amount;
      if (!label)
        existing.object.setText(`${target === 'hero' ? '−' : ''}${Math.ceil(existing.amount)}`);
      return;
    }
    if (this.captions.length >= 16) this.captions.shift()?.object.destroy();
    const object = this.scene.add
      .text(x, y, label ?? `${target === 'hero' ? '−' : ''}${Math.ceil(amount)}`, {
        fontFamily:
          getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() ||
          'sans-serif',
        fontSize: label ? '24px' : '23px',
        fontStyle: 'bold',
        color,
        stroke: '#18241f',
        strokeThickness: 5,
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(6000);
    this.captions.push({ object, target, amount, born: now, x, y, duration: label ? 0.65 : 0.46 });
  }

  pose(target: number | 'hero', now: number) {
    const hit = this.impacts.get(target);
    return hit ? { ...hit, age: Math.max(0, now - hit.born) } : undefined;
  }

  draw(g: Phaser.GameObjects.Graphics, now: number, reducedMotion: boolean) {
    for (const [id, hit] of this.impacts) {
      const age = now - hit.born;
      if (age >= 0.26) {
        this.impacts.delete(id);
        continue;
      }
      const p = age / 0.26,
        alpha = (1 - p) ** 2;
      if (id !== 'hero') {
        // Short ink splinters support the painted contact sprite without a large explosion.
        if (age < 0.085) {
          for (const angle of [hit.angle - 0.65, hit.angle + 0.65]) {
            const dx = Math.cos(angle) * 12,
              dy = Math.sin(angle) * 12;
            g.lineStyle(5, 0x18271e, 0.9).lineBetween(
              hit.x - dx,
              hit.y - 34 - dy,
              hit.x + dx,
              hit.y - 34 + dy,
            );
            g.lineStyle(2.5, 0xfff1cc, 1).lineBetween(
              hit.x - dx,
              hit.y - 34 - dy,
              hit.x + dx,
              hit.y - 34 + dy,
            );
          }
        }
        const count = hit.killed ? 5 : 3;
        for (let n = 0; n < count; n++) {
          const a = hit.angle + (n - (count - 1) / 2) * 0.68;
          const distance = reducedMotion ? 13 : 9 + 22 * (1 - (1 - p) ** 3);
          const x = hit.x + Math.cos(a) * distance,
            y = hit.y - 27 + Math.sin(a) * distance;
          g.lineStyle(3, 0x18271e, alpha).lineBetween(
            x,
            y,
            x + Math.cos(a) * 7,
            y + Math.sin(a) * 7,
          );
          g.lineStyle(1.5, 0xf7e9be, alpha).lineBetween(
            x,
            y,
            x + Math.cos(a) * 5,
            y + Math.sin(a) * 5,
          );
        }
      }
    }
    this.marks = this.marks.filter((mark) => now - mark.born < 0.3);
    for (const mark of this.marks) {
      const p = (now - mark.born) / 0.3;
      if (mark.action === 'evade') {
        const dx = Math.cos(mark.angle),
          dy = Math.sin(mark.angle);
        const x = mark.fromX ?? mark.x,
          y = mark.fromY ?? mark.y;
        for (let n = 0; n < 3; n++) {
          const offset = (n - 1) * 9;
          g.lineStyle(2, 0xe7e4c8, (1 - p) * 0.75).lineBetween(
            x - dy * offset,
            y + dx * offset,
            x + dx * 32 - dy * offset,
            y + dy * 32 + dx * offset,
          );
        }
      } else {
        const size = mark.action === 'counter' ? 55 : 38;
        g.lineStyle(mark.action === 'counter' ? 3 : 2, 0xb4e4d5, 1 - p);
        g.beginPath()
          .arc(mark.x, mark.y - 27, size, mark.angle - 0.85, mark.angle + 0.85, false)
          .strokePath();
      }
    }
    this.captions = this.captions.filter((c) => {
      const p = (now - c.born) / c.duration;
      if (p >= 1) {
        c.object.destroy();
        return false;
      }
      const rise = reducedMotion ? 0 : 21 * (1 - (1 - p) ** 3);
      c.object.setPosition(c.x, c.y - rise).setAlpha(p < 0.6 ? 1 : (1 - p) / 0.4);
      return true;
    });
  }
}
