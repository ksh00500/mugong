import { readFile, writeFile } from 'node:fs/promises';
const familyName = process.argv[2] ?? 'shaolin';
if (
  ![
    'shaolin',
    'zhuge',
    'tianjian',
    'dokmu',
    'hyeolma',
    'desert',
    'qingha',
    'snow',
    'bamboo', 'tomb',
  ].includes(familyName)
)
  throw Error('Unknown native family');
const staff = JSON.parse(await readFile('src/game/shaolin-staff-frames.json', 'utf8'));
const family = JSON.parse(
  await readFile(`src/game/${familyName}-family-frames.json`, 'utf8'),
).characters;
const names =
  familyName === 'tomb'
    ? ['고묘 도굴 함정꾼', '고묘 창 수문장', '고묘 쇠뇌병', '도굴두목 적호', '묘지기 석문', '기관장인 곽기', '고묘후인 월령']
    : familyName === 'bamboo'
    ? [
        '죽림 단도 암살자',
        '죽림 암기수',
        '죽림 함정꾼',
        '죽엽살수 청비',
        '취봉객 노개',
        '청죽검객 연청',
        '죽림은사 송월',
      ]
    : familyName === 'snow'
      ? [
          '설산 창 돌진병',
          '설산 빙술사',
          '설산 궁수',
          '설원창객 목진',
          '빙잠녀 설란',
          '백설노괴',
          '빙궁주 한설',
        ]
      : familyName === 'qingha'
        ? [
            '청하 도적',
            '청하 표국병',
            '청하 쇠뇌 포졸',
            '흑풍채주 마대봉',
            '청하표두 노진',
            '백면포두 철무',
            '하북패도 한무극',
          ]
        : familyName === 'desert'
          ? [
              '사막 기마병',
              '사막 암살자',
              '사막 환도병',
              '황사도적왕 아사르',
              '쌍환무희 나야',
              '흑사마승 발타',
              '대막도왕 아르칸',
            ]
          : familyName === 'hyeolma'
            ? [
                '혈도병',
                '혈영 암살자',
                '혈지 술사',
                '혈도객 적우',
                '혈마제자 연살',
                '홍의마녀 소홍',
                '혈마교주 적천',
              ]
            : familyName === 'shaolin'
              ? [
                  '권갑 승려',
                  '봉 승려',
                  '돌투척 승려',
                  '파계승 공허',
                  '철나한 도원',
                  '금강두타 불명',
                  '폐사 주지 무진',
                ]
              : familyName === 'zhuge'
                ? [
                    '기관병',
                    '창 문지기',
                    '쇠뇌병',
                    '개문수 양기',
                    '기관사 묵연',
                    '팔문장군 진괄',
                    '팔진노사 제갈현',
                  ]
                : familyName === 'dokmu'
                  ? [
                      '암기수',
                      '독창병',
                      '독폭탄술사',
                      '청린사왕',
                      '독의 묵칠',
                      '오독낭자 연화',
                      '만독곡주 사공염',
                    ]
                  : [
                      '검객',
                      '창 수문장',
                      '검기술사',
                      '낙검객 우진',
                      '쌍검 백홍',
                      '검귀 무명',
                      '천검노인 백운',
                    ];
const arts =
  familyName === 'shaolin'
    ? [...family.slice(0, 1), { ...staff, slot: 1 }, ...family.slice(1)]
    : family;
const template = await readFile('public/art/shaolin-staff-v1/review.html', 'utf8');
let html = template
  .replaceAll(
    '소림 봉 승려 · 8방향 동작 검토',
    `${familyName === 'tomb' ? '고묘' : familyName === 'bamboo' ? '죽림' : familyName === 'snow' ? '설산' : familyName === 'qingha' ? '청하현' : familyName === 'desert' ? '서역사막' : familyName === 'shaolin' ? '소림' : familyName === 'zhuge' ? '제갈 · 팔진고성' : familyName === 'hyeolma' ? '혈마전' : familyName === 'dokmu' ? '독무곡' : '천검산'} 7종 · 8방향 동작 검토`,
  )
  .replace(
    '원본 그림 60개 · 다섯 시점과 좌우 반전',
    '원본 그림 총 420개 · 캐릭터마다 다섯 시점과 좌우 반전',
  )
  .replace('캐릭터와 봉은 한 그림으로 재생', '캐릭터와 무기는 한 그림으로 재생')
  .replace(
    '<div class="controls">',
    '<div class="controls"><label>캐릭터 <select id="character">' +
      arts.map((a, i) => `<option value="${i}">${names[a.slot]}</option>`).join('') +
      '</select></label>',
  )
  .replace(/칸 704×576 · 최소 투명 여백 32픽셀/, '캐릭터별 고정 칸 · 최소 투명 여백 32픽셀')
  .replace(
    /const art=\{.*?\};\nconst directions=/s,
    `const arts=${JSON.stringify(arts)};let art=arts[0];\nconst directions=`,
  )
  .replace('art.frames.map(f=>f.texture)', 'arts.flatMap(a=>a.frames).map(f=>f.texture)')
  .replace(
    "key.replace('shaolin-staff-','')+'.webp'",
    familyName === 'shaolin'
      ? "key.startsWith('shaolin-staff-')?'../shaolin-staff-v1/'+key.replace('shaolin-staff-','')+'.webp':key.replace('shaolin-family-','')+'.webp'"
      : `key.replace('${familyName}-family-','')+'.webp'`,
  )
  .replace(
    "document.querySelector('#mode').onchange=()=>{time=0;paint();};",
    "document.querySelector('#mode').onchange=()=>{time=0;paint();};document.querySelector('#character').onchange=e=>{art=arts[Number(e.target.value)];time=0;paint();};",
  )
  .replace('공격 준비 → 내지르기 → 회수', '공격 준비 → 타격 / 발사 → 회수')
  .replace("'내지르기'", "'타격 / 발사'");
if (familyName === 'hyeolma') {
  const summary = JSON.parse(
    await readFile('docs/source/hyeolma-family-v1/selection-summary.json', 'utf8'),
  );
  html = html.replace(
    '원본 그림 총 420개',
    `프레임 420개 · 선택 원화 ${summary.uniqueSourceFigures}개`,
  );
  if (summary.pendingArt.length)
    html = html.replace(
      '<div class="controls">',
      '<p>일부 동작은 원화 교정 중입니다.</p><div class="controls">',
    );
}
await writeFile(`public/art/${familyName}-family-v1/review.html`, html);
console.log(`public/art/${familyName}-family-v1/review.html`);
