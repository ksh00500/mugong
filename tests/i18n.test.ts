import { afterEach, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import {
  detectLocale,
  isLanguagePreference,
  setLanguage,
  t,
  translatedError,
  formatNumber,
} from '../src/platform/i18n';
import { messages } from '../src/platform/messages';

afterEach(() => setLanguage('ko'));
it('큰 숫자는 언어 형식으로 표시하고 이름과 저장 값은 바꾸지 않는다', () => {
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'] as const) {
    setLanguage(language);
    expect(formatNumber(12430)).toBe('12,430');
    expect(t('{0}일 {1}시간', { 0: 1234, 1: 13 })).toContain('1,234');
  }
});
it('브라우저의 우선 언어, 지역 및 중국어 문자 체계를 감지한다', () => {
  expect(detectLocale(['ko-KR', 'en-US'])).toBe('ko');
  expect(detectLocale(['fr-FR', 'ja-JP', 'en-US'])).toBe('ja');
  expect(detectLocale(['en-GB', 'ko-KR'])).toBe('en');
  expect(detectLocale(['zh-Hans-SG'])).toBe('zh-CN');
  for (const tag of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh_Hant_TW'])
    expect(detectLocale([tag])).toBe('zh-TW');
  expect(detectLocale(['fr-FR'])).toBe('en');
  expect(detectLocale([])).toBe('en');
  expect(isLanguagePreference('auto')).toBe(true);
  expect(isLanguagePreference('fr')).toBe(false);
});
it('변수와 저장 실패 문구를 번역하고 임의 이름은 변경하지 않는다', () => {
  setLanguage('en');
  expect(t('{0}일 {1}시간', { 0: 6, 1: 13 })).toBe('6d 13h');
  expect(t('{0} 선택', { 0: '검객 $& <script>' })).toBe('Select 검객 $& <script>');
  expect(t('한글무인')).toBe('한글무인');
  expect(
    translatedError('저장에 실패했습니다. 진행을 멈췄습니다. 저장을 다시 시도해 주세요.'),
  ).toBe('Saving failed. Progress paused. Retry saving.');
});
it('화면·무공·물품·상태 문구에 네 번역과 동일한 변수가 모두 있다', () => {
  const keys = new Set<string>();
  const files = [
    'src/App.tsx',
    'src/pvp/PvpApp.tsx',
    'src/raid/RaidApp.tsx',
    'src/raid/model.ts',
    ...readdirSync('src/ui')
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => `src/ui/${f}`),
    'src/domain/content.ts',
    'src/domain/items.ts',
    'src/domain/game.ts',
    'src/platform/store.ts',
    'src/platform/storage.ts',
    'src/platform/session.ts',
    'src/game/feedback.ts',
    'src/platform/game-copy.ts',
    'src/platform/ui-copy.ts',
  ];
  for (const file of files) {
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isJsxText(node)) &&
        /[가-힣]/.test(node.text)
      )
        keys.add(node.text.trim());
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  const missing = [...keys].filter((key) => !messages[key]);
  expect(missing).toEqual([]);
  for (const [key, translations] of Object.entries(messages)) {
    expect(translations.length, key).toBe(4);
    const parameters = (value: string) => (value.match(/\{\d+\}/g) ?? []).sort();
    for (const value of translations) {
      expect(value.trim().length, key).toBeGreaterThan(0);
      expect(parameters(value), `${key}: ${value}`).toEqual(parameters(key));
    }
  }
// Parse all UI sources and validate every translation on shared CI workers.
}, 15_000);
