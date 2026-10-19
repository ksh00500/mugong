# 원화 묶음 크기 교정 입력

기존 생성 원본과 런타임 아틀라스를 보존한 결정적 내보내기다. 이번에는 imagegen 재제작을 하지 않았다. 캐릭터 전체0.225 배율과 게임 규칙을 바꾸지 않고 검토한 소스 묶음 단위의 제작 크기를 보정했다.

- `calibration.json`: 육안 검토한 제작 계수와 범위/이유. 기준은 READY·머리·몸통·장화의 비교이며 자동 전체 경계 높이 맞춤이 아니다.
- `*-before.json`: 교정 전4개 프레임 뱅크. 재실행 시 중복 보간/축소를 방지한다.
- `textures-before.json`: 같은 입력에 대응하는 원래 아틀라스 경로. 기존 파일은 삭제/덮어쓰기하지 않았다.
- `export-review.json`:13새아틀라스·100물리셀·104기존물리참조/141논리참조·원본 SHA·같은 묶음 계수 기록.

`scripts/export-native-size-v1.mjs` → `npm run assets:art-index` → `scripts/native-size-review.mjs` → `scripts/verify-native-size-v1.mjs` 순서로 재현한다. Sharp 경로는 `MUGONG_SHARP_PATH`로 지정한다. 넓은 셀/32px 패딩을 유지하고 칸을 넘으면 내보내기를 거부한다. 원화/발점은 같은 제작 계수로 변환하며 가로세로를 독립적으로 맞추지 않는다. 정수 픽셀 반올림은 있다.

같은 신체 자세도 카메라/생성마다 미세한 비율 차이가 남을 수 있다. 이번 고정 상수를 전 캐릭터의 해부학 실측값으로 해석하지 않는다. 모든 출력은 내용/종횡비를 유지하는 보간 결과이며 RGBA1:1이라고 표현하지 않는다. 게임에 연결한 범위와 검증/로컬 적용은 [기능 문서](../../native-size-v1.md)와 [검증](../../verification/native-size-review-v1/README.md)을 따른다.
