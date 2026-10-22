import { pendingChoices } from '../domain/character';
import { combatActionBlock, type CombatAction } from '../domain/combat-actions';
import type { BoundFighter } from '../domain/model';
import { recruitmentView } from '../domain/recruitment';
import { command, emptyGame, expireFighters, selectedFighter, tick } from '../domain/game';
import type { Command, GameState, InputFrame } from '../domain/model';
import type { CombatCueSink } from '../domain/combat';
import { readSave, writeSave, recoverLatestCopy } from './storage';
import { claimSession } from './session';
import { sound } from './audio';
import { migratePendingItems } from '../domain/pending-items';
import {
  isWalkablePreparation,
  nearestWaystationStop,
  waystationApproach,
  type WaystationStop,
} from '../domain/waystation';
export interface View {
  state: GameState;
  ready: boolean;
  busy: boolean;
  saving: boolean;
  error: string;
  notice: string;
  screen: 'lobby' | 'field';
  bagOpen: boolean;
  paused: boolean;
  revision: number;
  waystationDialogue: WaystationStop | null;
  waystationTarget: WaystationStop | null;
}
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : '저장 공간에 접근할 수 없습니다.';
export class GameStore {
  waystationWork?: { id: 'physician' | 'merchant' | 'blacksmith'; startedAt?: number };
  state = emptyGame();
  ready = false;
  busy = false;
  error = '';
  notice = '';
  screen: 'lobby' | 'field' = 'lobby';
  bagOpen = false;
  bagOpener: HTMLElement | null = null;
  paused = false;
  // Transient renderer state is never written into the player's save.
  rendererReady = false;
  waystationDialogue: WaystationStop | null = null;
  waystationTarget: WaystationStop | null = null;
  private listeners = new Set<() => void>();
  private lastUi = 0;
  private lastSave = 0;
  private revision = 0;
  private saving?: Promise<void>;
  private pendingSave?: GameState;
  private saveBlockers = 0;
  private lastRequestedSave = 0;
  private combatAction?: {
    action: CombatAction;
    runId: string;
    artId: string;
    requestedAt: number;
  };
  private snapshot: View;
  constructor() {
    this.snapshot = this.makeView();
  }
  private makeView(): View {
    return {
      state: this.state,
      ready: this.ready,
      busy: this.busy,
      saving: !!this.saving,
      error: this.error,
      notice: this.notice,
      screen: this.screen,
      bagOpen: this.bagOpen,
      paused: this.paused,
      revision: this.revision++,
      waystationDialogue: this.waystationDialogue,
      waystationTarget: this.waystationTarget,
    };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  notify() {
    this.snapshot = this.makeView();
    for (const f of this.listeners) f();
  }
  async load() {
    this.error = '';
    this.busy = true;
    this.notify();
    try {
      if (!(await claimSession()))
        throw new Error('다른 탭에서 이 세가를 열고 있습니다. 그 탭을 닫은 뒤 다시 시도해 주세요.');
      this.state = (await readSave()) ?? emptyGame();
      migratePendingItems(this.state);
      this.state.family.recruitment = recruitmentView(this.state.family, Date.now());
      expireFighters(this.state, Date.now());
      this.ready = true;
      this.screen = this.state.run ? 'field' : 'lobby';
      await writeSave(this.state);
      this.bagOpen = this.state.run?.phase === 'loot' && !pendingChoices(this.state.run);
    } catch (e) {
      this.error = errorText(e);
    } finally {
      this.busy = false;
      this.notify();
    }
  }
  async persist(blocking = true) {
    if (!this.ready) return;
    // Coalesce queued snapshots, but never let an older write overwrite a newer result.
    this.pendingSave = structuredClone(this.state);
    this.lastRequestedSave = performance.now();
    if (blocking) {
      this.saveBlockers++;
      this.busy = true;
    }
    if (!this.saving) {
      this.saving = this.drainSaves();
    }
    this.notify();
    try {
      await this.saving;
    } finally {
      if (blocking) this.saveBlockers--;
      this.busy = this.saveBlockers > 0;
      this.notify();
    }
  }
  private async drainSaves() {
    // Yield once so the promise is installed before either success or failure cleanup.
    await Promise.resolve();
    try {
      while (this.pendingSave) {
        const snapshot = this.pendingSave;
        this.pendingSave = undefined;
        await writeSave(snapshot);
        this.lastSave = performance.now();
      }
      this.error = '';
    } catch (e) {
      this.pendingSave = undefined;
      this.error = `${errorText(e)} 진행을 멈췄습니다. 저장을 다시 시도해 주세요.`;
      this.paused = true;
    } finally {
      this.saving = undefined;
    }
  }
  async dispatch(cmd: Command) {
    this.clearCombatAction();
    if (!this.ready || this.busy || this.error) return false;
    if (isWalkablePreparation(this.state.run)) {
      const service = (
        {
          heal: 'physician',
          refine: 'blacksmith',
          buySupply: 'merchant',
          sellMaterial: 'merchant',
          next: 'exit',
          restEvent: 'fortune',
        } as Record<string, WaystationStop>
      )[cmd.type];
      if (service && this.waystationDialogue !== service) return false;
    }
    if (cmd.type === 'bind' && this.state.run?.phase === 'combat' && !this.bagOpen) {
      this.notice = '가방을 열고 무기를 연결하세요.';
      this.notify();
      return false;
    }
    const usedKind =
      cmd.type === 'use'
        ? this.fighter()?.items.find((item) => item.id === cmd.id)?.kind
        : undefined;
    const changed = command(this.state, cmd);
    if (!changed) {
      this.notice =
        cmd.type === 'moveItem'
          ? '놓을 수 없는 위치입니다. 공간과 물품 종류를 확인하세요.'
          : '지금은 할 수 없는 행동입니다.';
      this.notify();
      sound('reject');
      return false;
    }
    this.notice = '';
    if (cmd.type === 'start' || cmd.type === 'startRecruit' || cmd.type === 'startBasic') {
      this.screen = 'field';
      this.paused = false;
      this.bagOpen = false;
    }
    if (!this.state.run && (cmd.type === 'next' || cmd.type === 'claim')) {
      this.screen = 'lobby';
      this.bagOpen = false;
      this.paused = false;
    }
    if (cmd.type === 'next') {
      this.bagOpen = false;
      this.waystationDialogue = null;
      this.waystationTarget = null;
    }
    if (cmd.type === 'openTraining') this.bagOpen = false;
    // Art switching is combat input. Saving its result must not freeze the fight.
    await this.persist(cmd.type !== 'switch');
    if (!this.error && isWalkablePreparation(this.state.run)) {
      const work = {
        heal: 'physician',
        refine: 'blacksmith',
        buySupply: 'merchant',
        sellMaterial: 'merchant',
      }[cmd.type as 'heal' | 'refine' | 'buySupply' | 'sellMaterial'];
      if (work)
        this.waystationWork = {
          id: work as 'physician' | 'merchant' | 'blacksmith',
          ...(this.waystationDialogue ? {} : { startedAt: performance.now() }),
        };
    }
    if (
      (cmd.type === 'choose' || cmd.type === 'chooseAugment' || cmd.type === 'deferTraining') &&
      !this.error &&
      this.screen === 'field' &&
      this.state.run?.phase === 'loot' &&
      !pendingChoices(this.state.run)
    ) {
      this.bagOpen = true;
      this.notify();
    }
    if (!this.error && cmd.type !== 'switch')
      sound(
        cmd.type === 'choose' || cmd.type === 'chooseAugment'
          ? 'level'
          : cmd.type === 'moveItem'
            ? 'store'
            : 'confirm',
      );
    if (!this.error && cmd.type === 'moveItem') {
      this.notice =
        cmd.place === 'warehouse'
          ? '세가 창고에 보관했습니다.'
          : cmd.place === 'equipped'
            ? '장비를 착용했습니다.'
            : cmd.place === 'ground'
              ? '획득 물품에 옮겼습니다.'
              : '가방에 수납했습니다.';
      this.notify();
    }
    if (!this.error && cmd.type === 'use') {
      this.notice = usedKind === 'medicine' ? '약을 사용했습니다.' : '비급을 읽었습니다.';
      this.notify();
    }
    if (!this.error && cmd.type === 'bind') {
      this.notice = '무기를 연결했습니다.';
      this.notify();
    }
    if (!this.error && cmd.type === 'arrangeItems') {
      this.notice = this.fighter()?.items.some((item) => item.place === 'ground')
        ? '가방을 정리했습니다. 공간이 부족한 물품은 남겨두었습니다.'
        : '가방을 정리하고 물품을 수납했습니다.';
      this.notify();
    }
    return !this.error;
  }
  openBag(value: boolean) {
    this.clearCombatAction();
    // Capture before saving disables the opener and the browser drops its focus.
    if (value && !this.bagOpen) this.bagOpener = document.activeElement as HTMLElement | null;
    if (this.error || pendingChoices(this.state.run)) return;
    this.bagOpen = value;
    this.notice = '';
    this.notify();
    if (value) void this.persist();
  }
  pause(value: boolean) {
    this.clearCombatAction();
    this.paused = value;
    this.notify();
    if (value) void this.persist();
  }
  async suspend() {
    this.paused = true;
    this.waystationDialogue = null;
    this.waystationTarget = null;
    await this.persist();
    if (!this.error) {
      this.screen = 'lobby';
      this.bagOpen = false;
      this.notify();
    }
  }
  resume() {
    if (!this.state.run || this.error || this.busy) return;
    this.screen = 'field';
    this.paused = false;
    if (this.state.run.phase === 'loot') this.bagOpen = !pendingChoices(this.state.run);
    this.notify();
  }
  async retry() {
    if (this.ready) await this.persist();
    else await this.load();
    if (!this.error && this.state.run?.phase === 'loot' && !pendingChoices(this.state.run)) {
      this.bagOpen = true;
      this.notify();
    }
  }
  async recover() {
    if (this.busy) return;
    this.busy = true;
    this.notify();
    try {
      if (!(await claimSession()))
        throw new Error('다른 탭에서 이 세가를 열고 있습니다. 그 탭을 닫은 뒤 다시 시도해 주세요.');
      await recoverLatestCopy();
      this.ready = false;
      await this.load();
    } catch (error) {
      this.error = errorText(error);
    } finally {
      this.busy = false;
      this.notify();
    }
  }
  approachWaystation(id: WaystationStop) {
    if (!this.canWalkWaystation()) return;
    if (nearestWaystationStop(this.state.run!.fighter, this.state.run!)?.id === id) {
      this.waystationDialogue = id;
      this.waystationTarget = null;
      this.state.run!.fighter.action = 'idle';
    } else this.waystationTarget = id;
    this.notify();
  }
  interactWaystation() {
    if (!this.canWalkWaystation()) return;
    const stop = nearestWaystationStop(this.state.run!.fighter, this.state.run!);
    if (!stop) return;
    this.waystationDialogue = stop.id;
    this.waystationTarget = null;
    this.state.run!.fighter.action = 'idle';
    this.notify();
  }
  closeWaystation() {
    if (this.waystationWork && !this.waystationWork.startedAt)
      this.waystationWork.startedAt = performance.now();
    this.waystationDialogue = null;
    this.waystationTarget = null;
    this.notify();
  }
  private canWalkWaystation() {
    return (
      isWalkablePreparation(this.state.run) &&
      this.rendererReady &&
      this.ready &&
      !this.busy &&
      !this.error &&
      !this.paused &&
      !this.bagOpen &&
      !this.waystationDialogue &&
      this.screen === 'field' &&
      !pendingChoices(this.state.run)
    );
  }
  advance(input: InputFrame, dt: number, now: number, emit?: CombatCueSink) {
    if (
      !this.rendererReady ||
      !this.ready ||
      this.busy ||
      this.error ||
      this.screen !== 'field' ||
      this.bagOpen ||
      this.paused ||
      this.waystationDialogue ||
      document.hidden
    ) {
      this.clearCombatAction();
      return;
    }
    const r = this.state.run;
    if (!r) return;
    const requested = this.combatAction;
    this.clearCombatAction();
    if (
      requested &&
      requested.runId === r.id &&
      requested.artId === r.fighter.arts[r.fighter.active]?.id &&
      performance.now() - requested.requestedAt <= 250 &&
      r.phase === 'combat' &&
      !pendingChoices(r) &&
      !combatActionBlock(r.fighter as BoundFighter, requested.action)
    ) {
      // A HUD click follows the fighter's facing, never the button's screen position.
      input = {
        ...input,
        aim: r.fighter.facing,
        attack: false,
        defense: requested.action === 'defense',
        ultimate: requested.action === 'ultimate',
      };
    }
    if (isWalkablePreparation(r) && this.waystationTarget) {
      if (input.dx || input.dy) this.waystationTarget = null;
      else {
        const goal = waystationApproach(this.waystationTarget, r);
        const dx = goal.x - r.fighter.x,
          dy = goal.y - r.fighter.y;
        if (Math.hypot(dx, dy) < 7) this.waystationTarget = null;
        else input = { ...input, dx, dy };
      }
    }
    const beforePhase = r.phase,
      beforeLevel = r.fighter.level,
      beforeKills = r.kills,
      beforeExchange = r.exchangeSeq;
    tick(r, input, dt, emit);
    if (
      r.phase !== beforePhase ||
      r.fighter.level !== beforeLevel ||
      r.kills !== beforeKills ||
      r.exchangeSeq !== beforeExchange ||
      now - this.lastRequestedSave > 1000
    ) {
      // Death, growth and wave transitions are barriers; routine checkpoints are not.
      const critical =
        r.phase !== beforePhase ||
        r.fighter.level !== beforeLevel ||
        r.exchangeSeq !== beforeExchange;
      const wave = r.wave;
      void this.persist(critical).then(() => {
        if (
          beforePhase !== 'loot' &&
          r.phase === 'loot' &&
          !pendingChoices(r) &&
          this.state.run === r &&
          r.wave === wave &&
          !this.error &&
          this.screen === 'field'
        ) {
          this.bagOpener = document.activeElement as HTMLElement | null;
          this.bagOpen = true;
          this.notify();
        }
      });
    } else if (now - this.lastUi > 100) {
      this.lastUi = now;
      this.notify();
    }
  }
  checkExpiry() {
    if (!this.ready || this.busy || this.error) return;
    if (expireFighters(this.state, Date.now())) {
      if (!this.fighter()) this.bagOpen = false;
      void this.persist();
    }
  }
  requestCombatAction(action: CombatAction) {
    const r = this.state.run;
    if (
      !r ||
      r.phase !== 'combat' ||
      pendingChoices(r) ||
      !this.rendererReady ||
      !this.ready ||
      this.busy ||
      this.error ||
      this.screen !== 'field' ||
      this.bagOpen ||
      this.paused ||
      this.waystationDialogue ||
      document.hidden ||
      combatActionBlock(r.fighter as BoundFighter, action)
    )
      return false;
    this.combatAction = {
      action,
      runId: r.id,
      artId: r.fighter.arts[r.fighter.active].id,
      requestedAt: performance.now(),
    };
    return true;
  }
  clearCombatAction() {
    this.combatAction = undefined;
  }
  fighter() {
    return selectedFighter(this.state);
  }
}
export const gameStore = new GameStore();
