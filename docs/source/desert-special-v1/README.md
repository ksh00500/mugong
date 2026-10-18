# 서역사막 특별 원화 출처

2026-10-07. 내장 imagegen 모드. 기존 `desert-family`의 대기 원화를 RGBA 1:1로 잘라 20개 시점 기준을 만들었다. 4보스·8행동의 40개 프롬프트는 [promptset.md](promptset.md), 실제 시간과 입력 SHA-256은 [preflight.json](preflight.json)이다. API 키/CLI 생성은 사용하지 않았다.

주 원본은 `asar/naya/balta/arkan` × `front/front-right/right/rear-right/back` × 각각 2패턴의 PNG 40장이다. `*-repair-v*.png` 10장은 수정 시안이며 선택된 6자세만 검토 manifest에 반영한다. `asar-front-dash-rejected-v1.png`은 검 끝이 위 경계에 닿은 최초 미선택 시안이다. [생성·수정 상태](generation-status.json)에서 모두 구분한다.

`generation-planned-jobs.json`은 준비 입력, `generation-draft-jobs.json`은 검토용 선택이다. 최종 적용 선택인 `generation-jobs.json`과 게임 `desert-special-frames.json`은 아직 만들지 않았다. `ground-anchors-draft.json`은 자동 제안이며 직접 검토 완료 좌표가 아니다.

생성 PNG의 일부 alpha=0 픽셀에는 색 RGB가 남아 미리보기에서 흐릿한 색으로 보였다. 해당 픽셀의 알파를 직접 확인했고 실제 브라우저 캔버스에서는 색 배경이 그려지지 않았다. 불투명 본체를 색상 기준으로 제거하지 않았다.

검토용 패킹은 기존 연결된 인물 추출기를 사용한다. 계획 격자선을 넘은 긴 무기도 해당 연결 성분 전체를 복사한다. 원화가 외곽에서 잘렸거나 두 자세를 공유한 경우 내보내기가 거절된다. 인물별 공통 셀과 최소 32px 투명 여백이며 각 구성 성분의 RGBA 복사를 대조한다. [내보내기 근거](export-review-draft.json). 이 검사는 머리 치수·관절·프레임별 몸 크기 통일성을 인증하지 않는다.

재현 순서:

```powershell
node scripts/finish-desert-special-draft.mjs
node --experimental-strip-types scripts/export-boss-special.mjs desert-special --draft
node --experimental-strip-types scripts/desert-special-draft-review-generated.mjs desert --draft
node scripts/verify-desert-special-draft.mjs
```

Sharp 런타임은 `MUGONG_SHARP_PATH`, 기존 Playwright 런타임은 `PLAYWRIGHT_BROWSERS_PATH`로 지정한다. 생성 준비 스크립트를 다시 실행하면 프롬프트 준비 내용이 덮어써질 수 있으므로 원본과 수정 이력을 먼저 확인한다.
