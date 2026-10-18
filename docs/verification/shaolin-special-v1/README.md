# 소림 특별 모션 검증

2026-10-06 로컬 적용. 제작과 적용 범위는 [작업 기록](../../shaolin-special-v1.md)을 따른다.

`canvas-full.json`, `canvas-reduced.json`, `webgl-full.json`, `webgl-reduced.json`: 각각 11,792개 상태 및 80개 실제 접촉 시점 검사. 모든 `failures`/`errors`는 빈 배열이고 렌더링 중 저장 전투 상태는 동일하다.

동명의 `*-windup.png`, `*-strike.png`, `*-recover.png`: 실제 Phaser 렌더러가 표시한 8패턴 × 8방향 비교. 캐릭터별 별도 ID로 64개 모습을 함께 표시한다. 숫자 1과 짧은 밝은 틴트는 피격 중 공격 유지 검사 입력이다.

`production/verification-1440.json`, `verification-1366.json`, `verification-1093.json`: 로컬 프로덕션의 이미지 수신과 모션 확인 화면 조작 검사. 대응하는 전투/확인 화면 PNG를 남겼다. 모든 페이지 오류는 0이다.

Canvas 및 WebGL의 준비·접촉 캡처와 1440/1093 화면을 직접 읽어 시각 검토했다. 그림이 이웃 셀과 섞이지 않고, 원화의 준비/접지/후속이 구분되며, HP바와 캐릭터가 겹치지 않는 것을 확인했다.

일반 권갑 피해·돌 투척 발동의 8방향 검사도 통과했고 기존 `../shaolin-family-v1/actual-release.json`에 남겼다. 한 차례 동시 Playwright 실행의 임시 캡처 경로 충돌은 별도 결과 폴더 재검사로 해소했다. 게임 실행 오류와 구분한다.
