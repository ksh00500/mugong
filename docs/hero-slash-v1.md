# 플레이어 베기 동작 개선 · 2026-10-04

플레이어가 칼을 베기보다 위로 올려치는 것처럼 보인다는 요청에 따라 기본 공격의 몸체 원화와 무기 궤적을 수정했다. 현행 플레이어 외형 10종에 적용하며, 외형 ID가 없는 기존 기본 캐릭터도 외형 0의 새 베기 자세를 사용한다. 이 문서는 로컬 구현·검증 기록이다.

## 원인과 변경

- 기존 준비 자세의 손이 얼굴 가까이에 있고, 무기별 차이가 없는 몸체 자세가 칼질을 손바닥 공격처럼 보이게 했다. 뒤쪽 세 방향에서는 기본 공격도 대기 그림을 사용했다.
- 기존 회전은 피해 접촉 후에 칼이 조준 방향을 지나갔다. `src/game/hero-attack-motion.ts`는 실제 접촉 0.09초를 중심으로 0.055~0.125초에 빠르게 베고, 이후 회수하게 한다. 기본 공격의 전체 0.28초와 전투 피해·쿨다운 계산은 바꾸지 않는다. 출처: `src/domain/combat.ts`의 `STRIKE_TIMING`.
- 외형마다 어깨 옆 준비, 허리/아랫가슴 높이 타격, 반대쪽 허리로 회수하는 원화 15개를 제작했다. 3단계 × 앞·앞 대각·옆·뒤 대각·뒤 5방향 = 150개다. 좌우 방향은 검토된 반전 정보로 8방향에 연결한다. 뒤쪽에서 손이 가려지거나 방향이 잘못 나온 그림은 추가 원화로 교체했다.
- 검·도는 측면에서 위에서 아래로 내려 베는 궤적, 봉·부채는 각 무기에 맞는 회전폭, 암기·권갑은 조준 중심의 작은 회전폭을 사용한다. `src/game/weapon-grips.ts`가 무기 축과 궤적을 소유한다. 손은 `src/game/hero-slash.ts`의 새 150개 기준점으로 연결하고, 실제 메시 삼각형의 변형·회전을 따라간다.
- 크기는 기존 캐릭터 기준의 머리 단위에 맞춘다. `src/platform/hero-slash-landmarks.json`과 `hero-slash-anchors.json`은 선택된 전달 파일의 크기·프레임에 묶인다. 기존 대기·이동·방어·궁극기·피격·사망 그림은 기존 승인 경로를 사용한다.
- Canvas에서 삼각형별 안티앨리어싱이 옅은 격자 이음새를 만들었다. `src/game/continuous-actor.ts`의 클립 경계를 장치 픽셀 기준 0.45만큼 겹쳐 그린다. 실제 메시 좌표와 손 부착 판정은 바꾸지 않는다. 이 공통 렌더 경로는 적에게도 적용된다.

## 원화와 재현 규칙

생성은 **built-in image_gen**으로 수행했다. 원본 PNG와 각 호출의 정확한 프롬프트는 `docs/source/hero-slash-v1/`의 `hero-0`~`hero-9`, `north-3`·`north-4`, `rear-6`~`rear-9`에 쌍으로 보존한다. `reference-0`~`reference-9`는 기존 승인 방향 원화에서 추출한 외형 참고 그림이다. 파일 해시와 생성/검토 요약은 같은 폴더의 `manifest.json`에 기록한다.

배포용 파일은 **`public/art/hero-slash-v1/hero-0.webp`~`hero-9.webp`**다. `scripts/export-hero-slash.mjs`는 선택된 인물 픽셀·알파를 보존해 격리·재배치하고 무손실 WebP로 내보낸다. 그림의 얼굴·색상·손을 코드로 덧칠하지 않는다. 수정이 필요하면 새 원본을 생성하고 원본 픽셀 기준 손 중심인 `docs/source/hero-slash-v1/anchors.mjs`를 다시 검토한다.

재현 순서:

1. bundled Sharp 경로를 `MUGONG_SHARP_PATH`에 지정한다.
2. `node --experimental-strip-types scripts/export-hero-slash.mjs`로 내보낸다.
3. `node --experimental-strip-types scripts/review-hero-slash.mjs`의 10장 비교표에서 얼굴·복장·방향·손 중심을 검토한다.
4. 무기 부착 검사는 `MUGONG_WEAPON_PROOF=docs/verification/hero-slash-v1/attachment`를 사용한다. 수정된 원화에 이전 UV나 크기 데이터를 재사용하지 않는다.
5. 연속 렌더는 `tests/e2e/player-slash.spec.ts`로 확인한다. `MUGONG_SLASH_RENDERER=WebGL`은 WebGL 모드다. 별도 Playwright 실행을 동시에 할 때는 각각 다른 `--output` 폴더를 사용한다.

## 검증 결과와 한계

- 타입 검사·프로덕션 빌드 통과. 단위 검사 44개 파일, 1,172개 통과.
- 선택 원화 150개: 인물별 준비·타격·회수 비교표를 직접 검토하고 손 중심 오지정 5개를 수정했다. 내보내기 검사에서 소스 가장자리에 잘린 인물 0개다.
- 10종 × 28개 장착 그림 × 8방향 × (일반 158개 시점 + 동작 감소 15개 시점) × Canvas/WebGL = **775,040개 렌더 상태**에서 손 부착 실패 0개. 최대 오차 약 `2.55e-13` 월드 단위로 기준 `0.01` 미만이다. 일반 시퀀스는 대기·이동·기본 공격·궁극기·방어·피격·사망을 포함한다.
- 외형 10종의 방향·동작 480개 상태에서 같은 외형 연결과 머리 기준 크기를 확인했다. 로비 그림 10개 로딩도 통과했다.
- 실제 Phaser WebGL 비교 화면은 10종 × 6무기 종류 × 8방향 × 준비/접촉/회수 = **1,440개 자세**다. 원화 비교와 실제 장착 비교를 구분한다.
- Canvas/WebGL 연속 렌더 기록 각각 외형 10종 × 6무기 × 3대표 방향을 생성했다. 접촉 0.09초의 360개 표본에서 그림의 무기 진행축이 몸체 회전 기준 조준 방향과 일치했다. 이 자료는 전투 시뮬레이션을 멈춘 렌더 검토이며 AI·전체 플레이 검증을 대신하지 않는다.
- 실제 이동·반복 공격·방어·궁극기 입력, 가방 일시정지, Canvas/WebGL 렌더 회귀 검사도 통과했다. 테스트 저장은 모두 독립 브라우저 컨텍스트에만 만들었다.

이 작업은 기본 공격 몸체 150개를 재제작한 것이다. 모든 궁극기·방어·사망 원화를 다시 만든 것은 아니다. 이산 시간선의 자동 부착 검사는 손 UV의 의미나 모든 동작의 미적 자연스러움을 자동으로 판단하지 않는다. 시각 검토와 자동 검사 결과를 함께 참고한다.

## 비교 자료

- [실제 프레임으로 만든 10종 베기 비교 GIF](verification/hero-slash-v1/player-cut-preview.gif)
- [접촉 시점의 10종 비교](verification/hero-slash-v1/player-cut-contact.png)
- [준비·타격·회수 원화와 손 중심 예시](verification/hero-slash-v1/source-0.png)
- [8방향·6무기 실제 장착 예시](verification/hero-slash-v1/attachment/hero-0-attacks.png)
- [외형 0~4 연속 Canvas 영상](verification/hero-slash-v1/continuous-0.webm)
- [외형 5~9 연속 Canvas 영상](verification/hero-slash-v1/continuous-1.webm)
- [외형 0~4 연속 WebGL 영상](verification/hero-slash-v1/continuous-webgl-0.webm)
- [외형 5~9 연속 WebGL 영상](verification/hero-slash-v1/continuous-webgl-1.webm)

전체 자료는 `docs/verification/hero-slash-v1/`에 있다. 기본 동작 기준점의 이전 이력은 [무기 부착 v1](weapon-attachment-v1.md), 적 원화의 최신 규칙은 [적 정합성 v3](hostile-consistency-v3.md)를 참고한다.
