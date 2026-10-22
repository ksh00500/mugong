import { TRAIT_IDS } from './character';
import { rollGrowth } from './growth-roll';
import { recruitAppearances } from './appearances';
import type { Family, Recruitment } from './model';

export const RECRUIT_LIMIT = 3;
export const RECRUIT_INTERVAL = 60 * 60 * 1000;
export const RECRUIT_PRICE = 100;

// Preview never mutates the save. A single saved command commits charge and draft together.
export function recruitmentView(family: Family, now: number): Recruitment {
  const original = family.recruitment ?? {
    tickets: RECRUIT_LIMIT, anchor: now, observedAt: now, sequence: 0, candidates: [],
  };
  const current = { ...original, candidates: [...original.candidates] };
  const time = Math.max(now, current.observedAt);
  current.observedAt = time;
  if (current.tickets === RECRUIT_LIMIT) current.anchor = time;
  else {
    const count = Math.max(0, Math.floor((time - current.anchor) / RECRUIT_INTERVAL));
    current.tickets = Math.min(RECRUIT_LIMIT, current.tickets + count);
    current.anchor = current.tickets === RECRUIT_LIMIT ? time : current.anchor + count * RECRUIT_INTERVAL;
  }
  return current;
}

export function recruitmentAction(family: Family, action: 'recruit' | 'buyRecruitTicket', now: number) {
  const next = recruitmentView(family, now);
  if (action === 'buyRecruitTicket') {
    if (next.tickets >= RECRUIT_LIMIT || (family.silver ?? 0) < RECRUIT_PRICE) return false;
    family.silver = (family.silver ?? 0) - RECRUIT_PRICE;
    next.tickets++;
    if (next.tickets === RECRUIT_LIMIT) next.anchor = next.observedAt;
  } else {
    if (next.candidates.length || next.tickets < 1) return false;
    next.tickets--;
    next.sequence++;
    const appearances = recruitAppearances();
    next.candidates = Array.from({ length: 3 }, (_, index) => ({
      id: `recruit-${next.sequence}-${index}`,
      seed: Math.floor(Math.random() * 0xffffffff),
      appearance: appearances[index],
      growth: rollGrowth(),
      innate: TRAIT_IDS[Math.floor(Math.random() * TRAIT_IDS.length)],
    }));
  }
  family.recruitment = next;
  return true;
}

