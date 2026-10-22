# 고묘 로컬 검증 자료

자동 검사와 직접 시각 검수 결과를 따로 보관한다. 생성 후보 수는 완성된 게임 그림 수와 다르다. 검증을 완료했고 [summary.json](summary.json)과 원화의 `generation-status.json`에 로컬 검증 완료 상태를 기록했다.

- `unit.json`, `unit.log`: 전체 단위 검사 결과.
- `build.log`: 타입 검사와 프로덕션 빌드 출력.
- `canvas-full.json`, `canvas-reduced.json`, `webgl-full.json`, `webgl-reduced.json`: 실제 전투 렌더러의 자세·방향·HP 여유 및 보스 접촉 프레임 검사.
- `actual-release.json`: 일반 적의 실제 발사·함정 생성·근접 피해 검사.
- `contact/`: 같은 배율과 발 기준선으로 표시한 인물별 60장 검수 이미지.
- `source-preview/`: 채택 원본을 비교하는 진단 이미지. 게임 원본을 수정하거나 리사이즈하는 과정은 아니다.
- `production/`: 1440×900, 1366×768, 1093×614 로컬 프로덕션 화면과 원화 검토 화면.
- `manual-review.json`: 직접 살펴본 화면과 접지점, 판단 및 남은 표현 범위.
- `browser.log`: 첫 실행에서 통과한 Canvas 전체·감소 설정 및 WebGL 전체 설정의 세 검사. 이후 사용자의 이어서 진행 요청으로 남은 검사를 재개했다.
- `browser-resume.log`: WebGL 감소 설정과 일반 적 실제 공격 검사 두 개 통과.
- `production-browser.log`: 세 해상도의 프로덕션 검사 세 개 통과.

Playwright는 독립 브라우저 컨텍스트를 사용한다. 실제 사용자의 저장을 테스트 데이터로 교체하지 않는다. 원격 배포는 수행하지 않는다.
