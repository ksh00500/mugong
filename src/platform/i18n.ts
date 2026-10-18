import { useSyncExternalStore } from 'react';
import { messages } from './messages';

export const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
] as const;
export type Locale = (typeof LANGUAGES)[number]['code'];
export type LanguagePreference = Locale | 'auto';
const storageKey = 'mugong-language-v1';

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const tag = language.toLowerCase().replaceAll('_', '-');
    if (/^ko(?:-|$)/.test(tag)) return 'ko';
    if (/^en(?:-|$)/.test(tag)) return 'en';
    if (/^ja(?:-|$)/.test(tag)) return 'ja';
    if (/^zh(?:-|$)/.test(tag))
      return /(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(tag) ? 'zh-TW' : 'zh-CN';
  }
  return 'en';
}
export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'auto' || LANGUAGES.some((language) => language.code === value);
}
function readPreference(): LanguagePreference {
  try {
    const saved = localStorage.getItem(storageKey);
    return isLanguagePreference(saved) ? saved : 'auto';
  } catch {
    return 'auto';
  }
}
let preference = readPreference();
function browserLocale() {
  if (typeof navigator === 'undefined') return 'ko';
  return detectLocale(navigator.languages.length ? navigator.languages : [navigator.language]);
}
let locale: Locale = preference === 'auto' ? browserLocale() : preference;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => `${preference}:${locale}`;
export function useLanguage() {
  useSyncExternalStore(subscribe, getSnapshot);
  return { locale, preference };
}
function update(next: LanguagePreference) {
  preference = next;
  locale = next === 'auto' ? browserLocale() : next;
  for (const listener of listeners) listener();
}
export function setLanguage(next: LanguagePreference) {
  if (!isLanguagePreference(next)) return;
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    // Language changes still work for this session when storage is unavailable.
  }
  update(next);
}
if (typeof window !== 'undefined')
  window.addEventListener('languagechange', () => {
    if (preference === 'auto') update('auto');
  });
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) update(readPreference());
  });

/** Korean source copy is the catalog key; saved game data remains language independent. */
const numberFormats = new Map<Locale, Intl.NumberFormat>();
export function formatNumber(value: number): string {
  let formatter = numberFormats.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    numberFormats.set(locale, formatter);
  }
  return formatter.format(value);
}
export function t(source: string, values: Record<string, string | number> = {}): string {
  const key = source.trim();
  const index = { en: 0, ja: 1, 'zh-CN': 2, 'zh-TW': 3 } as const;
  const translated = locale === 'ko' ? key : (messages[key]?.[index[locale]] ?? key);
  const result = translated.replace(/\{(\d+)\}/g, (match, id: string) =>
    Object.hasOwn(values, id)
      ? typeof values[id] === 'number'
        ? formatNumber(values[id])
        : String(values[id])
      : match,
  );
  return (
    source.slice(0, source.length - source.trimStart().length) +
    result +
    source.slice(source.trimEnd().length)
  );
}

export function gameTitle() {
  return locale === 'ko' ? '무공' : locale === 'en' ? 'MUGONG' : '武功';
}

export function warriorUnit(count: number) {
  return locale === 'en' && count === 1 ? 'warrior' : t('명');
}

export function translatedError(source: string) {
  const suffix = ' 진행을 멈췄습니다. 저장을 다시 시도해 주세요.';
  return source.endsWith(suffix)
    ? t('{0} 진행을 멈췄습니다. 저장을 다시 시도해 주세요.', {
        0: t(source.slice(0, -suffix.length)),
      })
    : t(source);
}
