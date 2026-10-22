# 진괄 창 공격 보정 · 2026-10-04

팔문장군 진괄의 이전 준비 프레임은 창을 머리 위로 들어 올렸다. 찌르기 타격과 연결될 때 휘두르는 동작처럼 보였고, 측면·뒤 대각선의 손이 겹치거나 창대와 팔 연결이 어긋났다. 후면 타격은 북쪽 몸 방향과 창끝 방향도 달랐다.

기본 제공 `image_gen.imagegen`으로 다섯 시점의 공격 여섯 자세, 총 30장을 다시 그렸다. 낮은 준비 → 허리로 당기기 → 두 손으로 전방 찌르기 → 전진 후속 → 당겨 회수 → 낮은 준비 복귀로 연결한다. 손은 창대를 떨어져 잡고 팔꿈치·어깨·골반과 지지발이 함께 움직이도록 요청했다. 측면 타격 두 장, 뒤 대각선 준비·회수 두 장, 후면 타격 두 장은 추가 보정 후 해당 칸만 선택했다. 뒤쪽 손이 몸에 가려지는 시점은 자연스러운 가림을 유지한다.

## 원화와 전달 규칙

- 생성 원본은 3×3 격자 중 위 두 줄의 여섯 그림을 사용한다. 빈 마지막 줄은 동작 공간으로 남긴다. 출력의 실제 크기는 파일마다 1446~1448×1086~1087이다. 정수 셀 경계로 읽고 픽셀을 재조정하지 않는다.
- 전달 시트는 기존 논리 프레임 4×3, 진괄의 모든 자세에 **640×448**, 최소 투명 여백 **32픽셀**이다. 긴 창 때문에 생긴 공간 부족을 몸 축소로 처리하지 않는다.
- 게임 표시 배율은 모든 프레임에서 **0.225**다. 프레임별 확대·축소나 관절의 자동 추적을 추가하지 않았다. 인물과 무기는 함께 그려진 원화다.
- 새 공격 그림 30장의 접지 좌표는 창날·술 대신 부츠를 보고 저장했다. 좌표는 선택 원본의 셀 왼쪽 위 기준이다. `scripts/apply-jingwal-attack-v2.mjs`에 선택 규칙과 좌표가 있고, 런타임은 내보낸 manifest만 읽는다.
- 기존 진괄 보행·피격·사망 30장과 나머지 여섯 제갈 인물 360장의 출처·픽셀 외곽·접지 좌표는 그대로다. 다른 인물의 전달 시트 30개는 SHA-256이 이전과 일치한다.

## 출처와 재현

[선택 원화·도구 출력 경로](source/zhuge-family-v1/jingwal-attack-v2-provenance.json), [생성·보정 프롬프트](source/zhuge-family-v1/), [선택 파일과 원본 셀](source/zhuge-family-v1/generation-jobs.json), [접지 좌표](source/zhuge-family-v1/ground-anchors.json)를 보관한다. 처음 만든 3×2 묶음은 몸이 커지고 경계가 잘려 적용하지 않았다. 기존 원본은 덮어쓰지 않았다.

Sharp 경로를 `MUGONG_SHARP_PATH`에 지정한 뒤 다음 순서로 재현한다.

```text
node scripts/apply-jingwal-attack-v2.mjs
node --experimental-strip-types scripts/export-shaolin-family.mjs zhuge
node --experimental-strip-types scripts/analyze-shaolin-family.mjs zhuge
node scripts/verify-jingwal-attack-v2.mjs
node scripts/family-review.mjs zhuge
npm run build
```

현재 보스의 찌르기·연격·휩쓸기·돌진·진법 공격은 기존 게임 판정과 효과를 유지하고 기본 공격 원화를 공유한다. 이번 보정은 기본 창 동작의 손·무기·자세를 고친 것이며, 다섯 기술 각각의 독립 원화 제작을 완료했다는 뜻은 아니다. 자동 검사는 여백·배율·방향·타격 시점·HP바를 확인한다. 관절의 자연스러움은 원화와 실제 합성 화면의 시각 검토 결과이며 인체 완전성을 자동 인증하지 않는다.

[검증 결과와 캡처](verification/jingwal-attack-v2/README.md). 로컬 확인은 `/art/zhuge-family-v1/review.html`의 **팔문장군 진괄**을 선택한다.
