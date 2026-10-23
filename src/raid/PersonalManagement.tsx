import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Command } from '../domain/model';
import type { RaidClient } from './client';
import { gameStore } from '../platform/store';
import { Choices } from '../ui/Choices';
import { AugmentChoices } from '../ui/AugmentChoices';
import { Inventory } from '../ui/Inventory';
import { carriedItems } from '../online/raid-persistence-view';
import { t } from '../platform/i18n';
export function PersonalManagement({ client }: { client: RaidClient }) {
  const online = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const view = useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot);
  const [bag, setBag] = useState(false),
    [busy, setBusy] = useState(false);
  const room = online.room,
    save = room?.ownSave;
  useEffect(() => {
    if (!save || !room) return;
    const execute = async (command: Command) => {
      if (busy) return false;
      setBusy(true);
      client.clearError();
      const op = crypto.randomUUID();
      const result = await new Promise<boolean>((resolve) => {
        const done = (ok: boolean) => {
          clearTimeout(timer);
          unsubscribe();
          resolve(ok);
        };
        const unsubscribe = client.subscribe(() => {
          const v = client.getSnapshot();
          if (v.error) done(false);
          else if (v.room?.operation === op) done(true);
        });
        const timer = setTimeout(() => done(false), 10000);
        if (!client.send({ type: 'personal', revision: room.revision, op, command })) done(false);
      });
      setBusy(false);
      return result;
    };
    const state = structuredClone(save.state);
    state.selectedId = room.match?.players[online.seat].fighter.id ?? state.selectedId;
    // A raid has no warehouse access. Heirlooms have their own read-only occupancy display.
    state.family.warehouse = [];
    if (room.match) {
      const f = state.family.roster.find((f) => f.id === state.selectedId);
      if (f)
        f.items.push(
          ...carriedItems(room.match, online.seat).map((i) => ({ ...i, name: `유품 · ${i.name}` })),
        );
    }
    gameStore.attachExternal(state, execute);
  }, [save?.revision, room?.revision, busy, client, online.seat]);
  useEffect(() => () => gameStore.detachExternal(), []);
  if (!save || !room) return null;
  const f = view.state.family.roster.find((f) => f.id === view.state.selectedId),
    training = view.state.family.training;
  return (
    <div className="raid-personal-management">
      <p>{t('개인 무인 · 층 보상 XP·수련·전리품은 서버 저장 · 은전은 생존 귀환 시 지급')}</p>
      <button onClick={() => setBag(true)} disabled={busy}>
        {t('가방 · 장비 · 전리품')}
      </button>
      {createPortal(
        <div className="app-shell raid-personal-overlay">
          {training && f?.augmentOffers?.length ? (
            <AugmentChoices fighter={f} busy={busy} />
          ) : training && f && training.offers.length > 0 ? (
            <Choices fighter={f} offers={training.offers} busy={busy} />
          ) : null}
          {bag && (
            <Inventory
              view={{
                ...view,
                busy,
                reservedItemIds: room.match
                  ? carriedItems(room.match, online.seat).map((i) => i.id)
                  : [],
              }}
              onClose={() => setBag(false)}
            />
          )}
        </div>,
        document.body,
      )}
      {!!room.match?.heirs?.length && (
        <section aria-label={t('유품 수습')}>
          <h2>{t('유품 · 일반 가방 공간 사용')}</h2>
          {room.match.heirs.map((h) => (
            <p key={h.id}>
              {h.item.name}{' '}
              {h.returned ? (
                t('원래 주인 창고로 전달')
              ) : h.lost ? (
                t('미수습 소실')
              ) : h.carrier !== undefined ? (
                `${room.seats[h.carrier]?.name} 운반 중 · 착용 불가`
              ) : (
                <button
                  disabled={busy || room.settling}
                  onClick={() =>
                    client.send({ type: 'recoverHeir', revision: room.revision, id: h.id })
                  }
                >
                  {t('수습')}
                </button>
              )}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
