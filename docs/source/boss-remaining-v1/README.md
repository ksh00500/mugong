# 네 지역 나머지 행동의 제작 자료

내장 imagegen 사용. `generation-jobs.json`은18선택 시트의 기준 프롬프트·입력 기준판·선택 PNG를 기록한다. `guides`는 기존 READY를 픽셀 크기 그대로 배치한 2×3 기준판, `banks`는 기본/특별 원화 비교판이다. `generated`에는 선택18개와 미채택3개 PNG 및 프롬프트/생성 경로 기록을 보존한다.

각 선택 시트0..4는 동일 접촉을 남·남동·동·북동·북에서 본 그림이고,5는 남향 READY 크기 기준이다. 선택 접촉은90그림이며 전체 게임 시퀀스1,590논리 프레임은 준비/회수 재사용과 연격 타격별 참조를 포함한다.

최초16시트의 저장 프롬프트는 기준 프롬프트이며 대화에서 덧붙인 시도별 제한 문구 전체의 정확한 사본은 아니다. 이후 무명2시트와 청린/무명 방향 교정은 저장된 프롬프트를 사용했다. `provenance.json`은 입력·선택·보류·출력의 해시와 이 제한을 기록한다. 정확한 전체 호출 로그라고 주장하지 않는다.

`export-review.json`의 배율은 READY를 기준으로 시트 전체에 단 한 번 적용한 정규화다. 개별 접촉의 프레임 맞춤 축소는 없다. 새 생성 출력은 원본 RGBA1:1가 아닌 정규화 출력이고, 원본 PNG는 보존했다. 각 접촉에32px 패딩과 직접 지정한 장화 기준점을 둔다. 기존 그림 재사용은 출처 프레임의 범위/픽셀/접지점을 그대로 따른다.

`action-audit.json`의 installed는 **이번 작업 시작 시점**의 상태다. false41개는 이번 연결 대상이며 현재 게임 미구현이라는 뜻이 아니다. 실제 완료 상태는 `completion.json`, 시퀀스/출처는 `export-review.json`, 런타임 등록은 `src/game/boss-remaining-frames.json`을 따른다.

재현 순서: `audit-boss-remaining.mjs`는 시작 전 감사용이다. 기존 생성 작업 명세를 다시 덮어쓰지 않는다. `export-boss-remaining.mjs` → `review-boss-remaining.mjs` → 단위/브라우저 검사 → 분리 빌드 → `publish-boss-remaining-local.mjs` 순서다. 내보내기는 `MUGONG_SHARP_PATH`와 Node의 TS 타입 제거를 사용한다.

[기능 범위](../../boss-remaining-v1.md) · [자동/직접 검증](../../verification/boss-remaining-v1/README.md).
