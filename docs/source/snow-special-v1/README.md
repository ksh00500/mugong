# 설산 목진 특별 원화

2026-10-06. 내장 imagegen으로 제작한 목진(3-1)의 돌진창·빙판 파쇄 2행동만 선택·적용한다. 5시점×2행동×6노출=60개의 독립 그림, PNG10개와 WebP5개다. 기본 원화의 READY를 네이티브 크기로 잘라 신원·무기·시점 기준으로 입력했다. 선택 파일과 원래 생성 경로는 generation-records.json, 실제 입력과 프롬프트는 promptset.md에 기록한다.

정면 돌진의 옆 방향 창과 앞대각선 돌진의 이웃 인물 연결 후보는 제외하고 재제작했다. 후보2개와 프롬프트를 보존했다. 출력은 각 인물 구성 픽셀을 원본 RGBA1:1로 복사하고 32px 이상 여백을 둔다. 발60좌표는5검토 표에서 부츠 중간과 낮은 발바닥을 보고 직접 지정했다. 표를 만들 때만0.5배 표시했으며 게임 원화는 리샘플링하지 않는다. 모든 기본·특별 게임 표시 배율은0.225다.

설란·백설노괴·한설의6행동 원화30개는 미완성이다. 설란 정면 빙구 시안1개 제작 후 내장 도구가 usage_limit_reached(429)를 반환했다. 이 시안은 게임에 연결하지 않는다. 원래 전체 계획20시점은 generation-planned-jobs.json, 선택한 목진5시점은 generation-jobs.json에 분리한다. 나머지 프롬프트와 신원 기준은 보존한다. 다음은 설란이다.

## 재검증 명령

MUGONG_SHARP_PATH를 사용 가능한 sharp 모듈 경로로 지정한 뒤 아래 순서로 실행한다. 초기 생성 준비 스크립트는 기존 파일을 덮어쓰지 않도록 초기화 때만 사용한다.

- node --experimental-strip-types scripts/analyze-tianjian-special.mjs snow
- node --experimental-strip-types scripts/export-boss-special.mjs snow-special
- node --experimental-strip-types scripts/review-snow-special-ground.mjs
- node --experimental-strip-types scripts/boss-special-review.mjs snow
- node scripts/audit-snow-special.mjs

[적용 범위](../../snow-special-v1.md) · [검증](../../verification/snow-special-v1/README.md).
