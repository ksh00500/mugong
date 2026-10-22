import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

// Bundle the domain's actual definitions; the review catalogue never duplicates their numbers.
const { outputFiles } = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import { ITEM_CATALOGUE, makeLootItem, itemValue, RARITY_NAMES } from './src/domain/items';
      import { BOSSES, REGIONS } from './src/domain/campaign';
      import { bossReward } from './src/domain/boss-loot';
      export const entries = [
        ...ITEM_CATALOGUE.map((definition) => ({ ...makeLootItem(definition.id, definition.id, 'ground'), region: REGIONS[definition.region]?.name, value: definition.value })),
        ...BOSSES.map((boss) => { const region = REGIONS.findIndex((region) => region.name === boss.region); const item = bossReward(region + '-' + boss.phase, 'boss-' + region + '-' + boss.phase); return { ...item, region: boss.region, value: itemValue(item), boss: boss.name }; })
      ];
      export { RARITY_NAMES };
    `,
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { entries, RARITY_NAMES } = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);
await writeFile('docs/source/items-v1.json', JSON.stringify(entries, null, 2) + '\n');
const kinds = {
  sword: '무기',
  robe: '도포',
  boots: '신발',
  charm: '패옥',
  medicine: '회복품',
  manual: '비급',
  ore: '재료',
};
const styles = { sword: '검', dao: '도', dart: '독침', gauntlet: '권갑', staff: '봉', fan: '부채' };
const lines = [
  '# 강호 물품 목록 v1',
  '',
  '실제 런타임 데이터에서 생성한 92개 물품이다. 품질 100, 강화 전의 수치와 기준가를 표시한다. 현재 판매 가능한 물품은 재료이며 장비 기준가는 판매 기능을 뜻하지 않는다. 상점 구매가는 별도이며 강화 재료는 보스 고유 재료를 자동 소모하지 않는다.',
  '',
  '효과 수치는 무기=공격, 도포=피해 경감, 신발=이동 속도 보정(수치×8), 패옥=모든 무공 기본 공격 보정, 회복품=체력 회복, 비급=경험치다. 재료는 전투 능력치를 추가하지 않는다. 대환단은 15·20웨이브 보스 보상에서 얻는다.',
  '',
  '| 물품 | 종류 | 등급 | 효과 수치 | 칸 | 기준가 | 지역 / 보스 |',
  '| --- | --- | --- | ---: | --- | ---: | --- |',
  ...entries.map(
    (item) =>
      `| ${item.name} | ${item.weaponStyle ? styles[item.weaponStyle] : kinds[item.kind]} | ${RARITY_NAMES[item.rarity]} | ${item.power} | ${item.w}×${item.h} | ${item.value}전 | ${item.boss ?? item.region ?? '공통'} |`,
  ),
  '',
  '[드랍·경제·검증 기준](gangho-completion-v1.md) · [원본 수치 JSON](source/items-v1.json)',
  '',
];
await writeFile('docs/items-v1.md', lines.join('\n'));
console.log(
  JSON.stringify({
    items: entries.length,
    definitions: 'docs/source/items-v1.json',
    review: 'docs/items-v1.md',
  }),
);
