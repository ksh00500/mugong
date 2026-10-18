# 고묘 원화와 선택 기록

내장 `image_gen.imagegen`으로 원화를 생성·수정했다. 생성 원본은 `provenance.json`의 절대 경로에 남기고 이 폴더에 복사한다. `generation-jobs.json`은 게임에 채택할 원본 파일과 자세별 실제 칸 좌표를 기록한다. 원본 전체를 채택하지 않고, 수정본에서 교정된 자세만 선택할 수 있다.

- `generation-requests.json`: 최초 원화의 인물·시점·프롬프트·입력 참조 목록.
- `repair-requests.json`, `second-repair-requests.json`: 손, 무기 구조, 관절, 방향 및 몸 크기 재검수에 따른 수정 요청과 선택 칸.
- `visual-issues.json`, `second-visual-findings.json`: 직접 시각 검수에서 발견한 문제. 후보를 발견했다는 기록이며, 후보 파일 자체가 게임에 모두 적용됐다는 뜻은 아니다.
- `repair-reference-packing.json`: 수정 입력용 한 자세 참조의 원본 좌표. 픽셀을 1:1로 복사하고 투명 여백만 더했다.
- `source-scan.json`, `source-review.json`: 채택할 420개 자세의 연결 성분·원본 잘림·중복 칸 검사.
- `ground-anchors.json`, `ground-anchor-overrides.json`: 발 접지점의 원본 칸 좌표 및 수동 교정 이유.
- `export-review.json`, `encoded-atlas-review.json`, `selected-art-audit.json`: 원본 RGBA 보존, 투명 패딩, 손실 없는 WebP 및 고유 그림 검사.
- `generation-status.json`: 적용·검증 완료 여부. 제작 중 수치와 검증 완료 수치를 구분한다.

최종 원화는 게임에서 모두 같은 0.225 배율로 표시한다. 무기나 옷의 외곽에 맞춰 매 프레임의 몸 크기를 다시 계산하지 않는다. 인물별 고정 칸에 최소 32픽셀 투명 여백을 두고 명시된 발 좌표를 사용한다. 생성 결과의 배열이 달라진 경우 실제 칸 좌표로 해석하며 그림 자체를 늘리거나 줄이지 않는다.

진행 및 한계는 [고묘 작업 기록](../../tomb-family-v1.md), 검증 결과는 [검증 폴더](../../verification/tomb-family-v1/README.md)에 기록한다.
