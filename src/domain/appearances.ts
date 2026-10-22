// Cosmetic identity only: no stat, trait, weapon or growth modifiers.
export const APPEARANCES = [
  { id: 0, name: '백의 검객', concept: '흰 도포, 붉은 끈, 긴 흑발' },
  { id: 1, name: '청록 유랑객', concept: '청록 후드, 짧은 흑발, 가벼운 여행복' },
  { id: 2, name: '은발 협객', concept: '은발 단발, 자주색 매듭, 자주색 도포' },
  { id: 3, name: '홍의 무인', concept: '갈색 높은 묶음머리, 홍의, 활기찬 표정' },
  { id: 4, name: '묵안 검객', concept: '눈가의 검은 천, 남색 도포, 묶은 흑발' },
  { id: 5, name: '황의 수행자', concept: '삭발, 굵은 눈썹, 황토색 승복, 큰 염주' },
  { id: 6, name: '연화 무인', concept: '긴 땋은 흑발, 꽃 비녀, 연보라 도포' },
  { id: 7, name: '노년 협객', concept: '회색 머리와 수염, 먹색 도포, 노련한 인상' },
  { id: 8, name: '서역 유랑객', concept: '구릿빛 피부, 곱슬 흑발, 쪽빛 머리띠' },
  { id: 9, name: '도화 협객', concept: '검은 쪽머리 두 개, 분홍 끈, 복숭아색 도포' },
] as const;
export type AppearanceId = (typeof APPEARANCES)[number]['id'];

export function recruitAppearances(random: () => number = Math.random): AppearanceId[] {
  const ids = APPEARANCES.map((appearance) => appearance.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const at = Math.floor(random() * (i + 1));
    [ids[i], ids[at]] = [ids[at], ids[i]];
  }
  return ids.slice(0, 3);
}
