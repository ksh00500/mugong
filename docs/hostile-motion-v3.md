# 적 공격·피격 연속 동작 v3

2026-10-02. 방향 그림이 포즈 시트보다 우선하여 적들이 공통 리그로 비슷하게 움직이던 부분을 개선했다. 새 원화를 일괄 생성한 작업은 아니다. 현재 실제 방향 그림을 연속 리그로 변형하며, 모든 방향에서 역할과 보스의 현재 공격을 따라 동작을 선택한다.

`src/game/hostile-motion.ts`는 베기·찌르기·활/쇠뇌 발사·투척·시전·돌진·충격·소환 8종을 구분한다. 보스는 현재 `move`를 따라 패턴 전환에 맞게 동작이 달라진다. 공격 준비에서 팔/상체/자세를 모으고, 타격 때 내밀거나 휘두르고, 회복 때 중립으로 돌아온다. 경계 포즈는 연속이며 실제 시뮬레이션 타이머를 사용한다. 투척수의 원거리 준비 중 불필요한 전방 이동을 줄였다.

`src/game/directional-motion.ts`의 손 뻗기·팔 올리기·몸 낮추기 가중치를 추가했다. 기마는 발굽을 유지하고 기수 상체를 변형한다. `src/game/CombatScene.ts`에서 피격 반응을 0.13→0.2초로 늘리고 일반 적의 시각적 반동은 9px, 보스는 4px로 구분한다. 피격은 연출만 덮으며 공격 취소·스턴·HP·판정·세계 좌표·저장 데이터는 변경하지 않는다. 움직임 줄이기에서는 자세 차이를 고정 표시하고 반복/큰 이동을 제거한다.

실제 WebGL 캡처에서 팔 변형 시 UV가 가로로 찢어지던 문제가 확인됐다. `src/game/continuous-actor.ts`에서 변형 메시는 최적화 사각형 합성 대신 삼각형 렌더링을 사용한다. 한 적당 기존 메시 하나를 유지한다. 수정 후 WebGL 및 Canvas 캡처를 확인했다. 소프트웨어 GPU 영상 인코딩은 45초 제한을 초과하여 영상 검사만 120초로 늘렸다.

검증: 전체 단위 29파일 680개 통과. `tests/hostile-motion.test.ts`는 21역할 및 40보스 고유 패턴들의 준비→타격→회복 경계, 팔방 피격과 유한 수치, 시뮬레이션 원본 불변, 움직임 줄이기를 검사한다. 10지역 브라우저 검사는 일반 적/40보스의 공격·피격·사망 메시 상태 연결을 검사한다. WebGL 및 Canvas 동작 영상 검사도 통과했다. 증거는 `docs/verification/hostile-motion-v3/`, `docs/verification/hostile-presentation-v2/`다. 캡처의 모아 놓은 적과 높은 체력은 독립 브라우저 테스트 데이터다. 사람의 실제 플레이 평가나 모든 원화의 자연스러움을 인증하는 결과는 아니다.

관련: [적 그림/탄종](hostile-presentation-v2.md), [전투 판정](enemy-combat-v1.md), [방향 리그](directional-motion-v2.md), [밸런스](balance-v2.md).

Daytona에 `/srv/mugong/releases/20261002-hostile-motion-v3`로 반영했다. 이전 `20261002-hostile-balance-v2`를 보관하고 코드 변경분을 적용한 뒤 전체 명세 264파일을 검증했다. 공개 진입 코드 `main-9UV7IsKd.js`, 전투 모듈 `mount-C-Q869Jh.js`와 index의 SHA256이 로컬 빌드와 일치한다. 증거: `docs/verification/daytona-20261002-hostile-motion-v3/public-files.json`.

배포 후 공개 브라우저 검사 3개(설산·죽림 로딩, 출전·전투·가방·저장 복원) 통과. 개발용 소스 import 없는 검사를 사용했으며 JavaScript 예외와 실패 에셋 요청 없음. 전투/가방/저장 캡처는 `docs/verification/daytona-20261002-hostile-motion-v3/public/`에 있다.
