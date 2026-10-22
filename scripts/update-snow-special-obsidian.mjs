import { readFile, writeFile, readdir } from 'node:fs/promises';
const root = 'docs/obsidian-sync/2026-10-06-snow-special-v1/notes';
const run = JSON.parse(await readFile('docs/verification/snow-special-v1/run-record.json'));
const docs = 'file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/';
const evidence = `[목진 적용](${docs}snow-special-v1.md) · [이번 검증](${docs}verification/snow-special-v1/README.md)`;
const scope =
  '기존 완료4지역16보스32행동에 설산 목진1보스2행동60프레임을 추가했다. 합계17보스34행동1,020논리 프레임이며 설산 전체 완료는 아니다. 설란·백설노괴·한설은 이미지 생성 도구의 usage_limit_reached(429)로 원화가 미완성이다. 다음은 설란부터이며 지역 선택을 다시 묻지 않는다.';
for (const name of await readdir(root)) {
  let s = await readFile(root + '/' + name, 'utf8');
  if (name === 'README.md') s = s.replace('4지역 특수 원화', '4지역 완료·설산 목진 특수 원화');
  if (name === 'project-overview.md')
    s = s.replace(
      '합계 32행동까지 로컬 연결했다.',
      '합계 32행동을 로컬 연결했다. 이후 설산 목진2행동을 추가해 현재17보스34행동이다.',
    );
  if (name === 'current-status.md') {
    s = s.replace(
      '합계 16명·32행동·960프레임',
      '설산 목진1명·2행동·60프레임 추가, 합계17명·34행동·1,020프레임',
    );
    s = s.replace(
      '플레이어 70%, 4지역 특별 원화, 새 추격 보법',
      '플레이어 70%, 4지역 특별 원화+설산 목진2행동, 새 추격 보법',
    );
    const a = s.indexOf('## 가장 최근 검증'),
      b = s.indexOf('## 다음 범위', a);
    s =
      s.slice(0, a) +
      `## 가장 최근 검증\n\n설산 목진의 타입 검사·프로덕션 빌드, 전체 단위${run.unit.passed}개, 소스 브라우저${run.sourceBrowser.passed}개와 프로덕션${run.productionBrowser.passed}개가 통과했다. Canvas/WebGL×일반/움직임 감소의 특별2행동과 기본7인 회귀, 지역 전환60프레임, 3화면 크기를 확인했다. 원본10장·5시점60발 좌표와 실제 캡처는 별도 직접 검토했다. 이전 청하현 검사 수를 이번 검사로 합산하지 않는다.\n\n${evidence}.\n\n` +
      s.slice(b);
    s = s.replace(
      '특별 원화 미착수 지역 6곳과 완료 4지역의 미전용 행동',
      '설산 나머지3보스, 미착수5지역과 완료4지역의 미전용 행동',
    );
  }
  if (name === 'art-and-assets.md') {
    s = s.replace(
      /\| 설산[^\n]+/,
      '| 설산 | 일반3·보스4 연결 | 목진1·2행동·60독립 프레임, 3보스 미완성 | docs/snow-special-v1.md |',
    );
    s = s.replace('합계 16보스·32행동·960논리 프레임', '합계17보스·34행동·1,020논리 프레임');
    s = s.replace('청하현 20행동 중 8/12다.', '청하현 20행동 중 8/12, 설산18행동 중2/16이다.');
    s = s.replace(
      '## 제작·내보내기 규칙',
      '- 설산 목진: 빙판 돌진창/창끝 빙판 파쇄. 선택10원본 중 정면·앞대각선 돌진2개 재제작.60독립 그림/5텍스처이며 자세 재사용 없음. 흰 창 장식과 한쪽 발을 잡는 자동 발 후보를 제외하고 두 부츠 중심을 직접60개 저장했다. 설란 시안1개는 미적용, 나머지30원화는 생성 한도로 미완성.\n\n## 제작·내보내기 규칙',
    );
    s = s.replace(
      '[청하현](http://127.0.0.1:5173/art/qingha-special-v1/review.html).',
      '[청하현](http://127.0.0.1:5173/art/qingha-special-v1/review.html), [설산 목진](http://127.0.0.1:5173/art/snow-special-v1/review.html).',
    );
  }
  if (name === 'backlog.md') {
    s = s.replace(
      '각 지역4보스·특별8행동을 연결했다.',
      '각 지역4보스·특별8행동을 연결했다. 추가로 설산 목진1보스·2행동을 연결했으며 설산3보스는 미완성이다.',
    );
    s = s.replace(
      /\| 설산·죽림[^\n]+/,
      '| 설산 설란 → 백설노괴 → 한설 | 목진 완료, 나머지3보스6행동의30원화는 생성 사용량 한도로 미완성 |\n| 죽림·고묘·서역사막·혈마전·팔진고성/제갈 | 기본 원화 완료, 특별 전용 원화 미착수 |',
    );
    s = s.replace(
      '현재 다음은 **설산**이다.',
      '현재 다음은 **설산 설란**이다. 목진의 돌진창/빙판 파쇄는 이미 완료해 다시 그리지 않는다.',
    );
    s = s.replace('4지역 특별 원화와 새 추격 대응', '4지역 특별 원화+설산 목진과 새 추격 대응');
  }
  if (name === 'architecture.md') {
    s = s.replace(
      '소림·천검산·독무곡·청하현 `*-special-frames.json`',
      '소림·천검산·독무곡·청하현과 설산 목진 `*-special-frames.json`',
    );
    s = s.replace(
      '## 전투·저장',
      '설산의 실제 kit는 boss-wave3.ts와 boss-wave5.ts에 나뉘므로 검토 페이지는 두 원문을 함께 읽는다. 현재 특별 등록은3-1 목진만 있고3-2~4는 기본 원화로 남긴다. 소림 무진4-4와 설산 목진3-1을 구분하며 목진의 기본 원본 파일 이름mujin을 런타임 인물IDmokjin으로 착각하지 않는다.\n\n## 전투·저장',
    );
  }
  if (name === 'gameplay-systems.md')
    s = s.replace(
      '그림 교체가 별도',
      '설산 목진 돌진은0.4초 공격의0.34초, 파쇄는0.55초 공격의0.28초 접촉을 따른다. 피해·돌진·빙판 수치와 CC 규칙은 변경하지 않았다. 그림 교체가 별도',
    );
  if (name === 'known-issues.md') {
    s = s.replace(
      '특별 원화는 4지역·32행동만 전용 제작. 미착수6지역',
      '특별 원화는4지역32행동+설산 목진2행동. 설산 나머지3보스와 미착수5지역',
    );
    s = s.replace('특별 원화4지역·새 보법', '특별 원화4지역+설산 목진·새 보법');
    s = s.replace(
      '## 상태를 잘못 읽지 않기',
      '- [current-blocker] 내장 이미지 생성 사용량 한도429. 목진의 완성10원본은 적용했지만 설란·백설노괴·한설은 제작 완료로 간주하지 않는다. 설란 정면 빙구 시안1개는 게임에 연결하지 않았다.\n\n## 상태를 잘못 읽지 않기',
    );
  }
  if (name === 'decisions.md')
    s = s.replace(
      '## 미래 설계와 미확정 사항',
      '- [decision] 현재 미완성 맨 위는 설산 설란이다. 이미지 생성 한도 때문에 나머지 보스 원화를 기본 모션 복사로 완료 처리하지 않는다. 완성한 목진만 별도로 연결·검증한다.\n\n## 미래 설계와 미확정 사항',
    );
  if (name === 'worklog-2026-10-06.md') {
    s = s.replace(
      '소림/천검산/독무곡/청하현 특별32행동, 새 추격 대응. 청하현 최종 빌드',
      '소림/천검산/독무곡/청하현32행동+설산 목진2행동, 새 추격 대응. 목진 최종 빌드',
    );
    s += `\n\n## 설산 목진 특별 모션 후속\n\n${scope}\n\n선택PNG10개, 원본 픽셀1:1, 고정0.225,32px 이상 출력 여백, 발60좌표 직접 검토. 정면 방향/앞대각선 인물 연결 후보2개는 재제작했다. 단위${run.unit.passed}개·소스9개·프로덕션3개가 이번 실행에서 통과했다. 특별시간${run.specialTimeSamples}+접촉${run.specialContactSamples}, 기본상태${run.basicTimeSamples}+접촉${run.basicContactSamples}, 지역 전환60등록. 원본10복사와WebP5/dist 해시가 일치했다. 실제 사용자 저장 변경·공개 배포는 없다. 자동 검사와 직접 시각 검토 범위를 구분한다.\n\n${evidence}.\n`;
  } else s += `\n\n## 설산 목진 후속 상태\n\n${scope}\n\n${evidence}.\n`;
  await writeFile(root + '/' + name, s);
}
console.log('Ten project note drafts updated; before hashes retained for conflict checking');
