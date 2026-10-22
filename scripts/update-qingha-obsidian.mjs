import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = 'docs/obsidian-sync/2026-10-06-qingha-special-v1';
const docs = 'file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/';
for (const name of await readdir(root + '/notes')) {
  let s = await readFile(root + '/notes/' + name, 'utf8');
  if (name !== 'worklog-2026-10-06.md')
    s = s
      .replaceAll('소림·천검산·독무곡', '소림·천검산·독무곡·청하현')
      .replaceAll('3지역', '4지역')
      .replaceAll('12명', '16명')
      .replaceAll('12보스', '16보스')
      .replaceAll('24행동', '32행동')
      .replaceAll('720논리 프레임', '960논리 프레임')
      .replaceAll('720프레임', '960프레임');
  if (name === 'art-and-assets.md') {
    s = s.replace(
      /\| 청하현[^\n]+/,
      '| 청하현 | 일반3·보스4 연결 | 보스4·8행동·240논리 프레임 | docs/qingha-special-v1.md |',
    );
    s = s.replace('독무곡 18행동 중 8/10이다.', '독무곡 18행동 중 8/10, 청하현 20행동 중 8/12다.');
    s = s.replace(
      '## 제작·내보내기 규칙',
      '- 청하현: 마대봉 호령/어깨 돌진, 노진 삼연 창/호위 지휘, 철무 사슬 포획/회전, 한무극 축적 참격/대회전. 선택 원본40개 중15개 재제작. 노진 뒷모습 호위 회수는 올바른 준비 자세를 명시 재사용해239개 독립 사용 그림/240논리 프레임이다. 호위기는 flag 시전이며 방어 유지가 아니다.\n\n## 제작·내보내기 규칙',
    );
    s = s.replace(
      '게임 중 픽셀 탐색으로',
      '청하현도20시점 표240발 후보를 직접 검토했고, 노진 뒷모습3노출의 발 중심을 수동 보정했다. 게임 중 픽셀 탐색으로',
    );
    s = s.replace(
      '[독무곡](http://127.0.0.1:5173/art/dokmu-special-v1/review.html).',
      '[독무곡](http://127.0.0.1:5173/art/dokmu-special-v1/review.html), [청하현](http://127.0.0.1:5173/art/qingha-special-v1/review.html).',
    );
  }
  if (name === 'backlog.md') {
    s = s
      .replace('소림 → 천검산 → 독무곡.', '소림 → 천검산 → 독무곡 → 청하현.')
      .replace(
        '청하현·설산·죽림·고묘·서역사막·혈마전·팔진고성/제갈',
        '설산·죽림·고묘·서역사막·혈마전·팔진고성/제갈',
      );
    s = s.replace(
      '다음 지역은 사용자 지시에 맞춰 선택한다.',
      '청하현 나머지12행동은 기존 기본 원화를 재사용하며 추가 전용 자세가 남아 있다.\n\n사용자가 지역을 지정하지 않고 다음 보스를 요청하면 이 표의 맨 위 미착수 지역으로 진행한다. 다시 선택 질문을 하지 않는다. 현재 다음은 **설산**이다. 명시한 지역 지시는 우선한다.',
    );
  }
  if (name === 'current-status.md') {
    s = s
      .replace('## 가장 최근 검증', '## 가장 최근 검증')
      .replace(
        /독무곡 특별 모션 완료 시[\s\S]*?## 다음 범위/,
        '청하현 특별 모션의 타입 검사·프로덕션 빌드를 통과했다. 최종 단위/브라우저 수와 육안 캡처 검토는 이번 실행 결과로 아래 근거에 기록한다. 이전 독무곡 검사 수를 새 검증 수로 합산하지 않는다.\n\n근거: [청하현 실행 기록](' +
          docs +
          'verification/qingha-special-v1/run-record.json), [검증과 캡처](' +
          docs +
          'verification/qingha-special-v1/README.md).\n\n## 다음 범위',
      );
    s = s.replace('미착수 지역 7곳과 완료 4지역', '미착수 지역 6곳과 완료 4지역');
  }
  if (name === 'known-issues.md') s = s.replace('미착수7지역', '미착수6지역');
  if (name === 'architecture.md')
    s = s.replace(
      '## 전투·저장',
      '검토 페이지는 기본/특별 최대 높이에 맞춰 캔버스 높이를 잡아 들어 올린 무기 잘림을 방지한다. 청하현 오프라인 발 검토는 선택 인물 구성 픽셀만 사용하며, 옆 셀 인물을 부츠 후보로 포함하지 않는다. 런타임 원본 픽셀 복사도 해당 인물 구성만 사용한다.\n\n## 전투·저장',
    );
  if (name === 'gameplay-systems.md')
    s = s.replace(
      '그림 교체가 별도',
      '청하현 노진은 실제0.1/0.6/1.1초 접촉 사이 재장전하고 호위기는 flag 시전 후 회수한다. 그림 교체가 별도',
    );
  if (name === 'decisions.md')
    s = s.replace(
      '## 미래 설계와 미확정 사항',
      '- [decision] 다음 보스/지역이 미지정이면 남은 표의 맨 위로 진행하고 선택을 다시 묻지 않는다. 청하현 다음은 설산이며 명시한 지시는 우선한다.\n- [decision] 불완전한 관절 후보를 런타임에 쓰지 않는다. 청하현 노진 호위 뒷모습 회수1노출은 올바른 준비 자세를 명시 재사용하며 논리 수와 독립 그림 수를 구분한다.\n\n## 미래 설계와 미확정 사항',
    );
  if (name === 'worklog-2026-10-06.md') {
    s = s.replace(
      '플레이어70%, 소림/천검산/독무곡 특별24행동, 새 추격 대응. 독무곡 최종 빌드',
      '플레이어70%, 소림/천검산/독무곡/청하현 특별32행동, 새 추격 대응. 청하현 최종 빌드',
    );
    s = s.replace(
      '다음 제작은 남은7지역의 특별 원화 또는 완료3지역의 추가 행동이며 사용자 다음 선택에 따른다.',
      '남은 특별 원화 미착수6지역과 완료4지역의 추가 행동을 구분한다. 사용자 지정이 없으면 맨 위의 설산으로 진행하고 다시 선택을 묻지 않는다.',
    );
    s +=
      '\n\n## 청하현 특별 모션 후속\n\n4보스8행동·5원화 시점/8표시 방향·240논리 프레임/20텍스처를 로컬 연결했다. 선택 원본40개 중15개를 손·무기·관절·몸 크기 기준으로 재제작했다. 노진 뒷모습 호위 회수1노출은 올바른 준비 그림을 명시 재사용하여 독립 사용 그림239개다. 원본 픽셀1:1, 공통0.225, 출력32픽셀 이상 여백을 유지했다. 발20시점 표와 실제 전투 캡처를 따로 검토한다.\n\n청하현 실제20행동 중12행동은 기존 기본 원화다. 공개 배포는 수행하지 않았다. 사용자 저장과 분리한 독립 테스트 컨텍스트만 사용했다. 이번 검사 수는 아래 실행 기록을 따른다.\n\n[실행 요약](' +
      docs +
      'verification/qingha-special-v1/run-record.json) · [검증 상세](' +
      docs +
      'verification/qingha-special-v1/README.md) · [제작 규칙](' +
      docs +
      'qingha-special-v1.md).\n';
  }
  await writeFile(root + '/notes/' + name, s);
}
// Preserve before hashes, refreshed after all final formatting/verification.
console.log('Updated ten local note drafts; vault application is a separate hash-checked step.');
