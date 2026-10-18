# 검 베기 시간선 재구성 · 2026-10-04

로비 화질 작업보다 검 모션을 우선하라는 사용자 요청에 따라 플레이어 10종의 검·도 기본 공격을 수정했다. 로컬 구현 기록이며 배포 완료 기록이 아니다.

## 확인한 원인

v1의 준비 구간은 대기 상태의 아래쪽 검에서 앞쪽 위로 약 145도 회전했다. 짧은 베기보다 이 상승 궤적이 눈에 띄었다. 몸체 전진도 피격 이벤트 유무에 의존하여 접촉 순간 위치가 갑자기 바뀔 수 있었다. 출처: `src/game/weapon-grips.ts`, `src/game/CombatScene.ts`의 이전 구현.

## 참고 자료와 적용 판단

- [Kiddolink — Animated Character Base: Swordsman](https://kiddolink.itch.io/animated-character-base): 제작자 페이지의 무료·public domain/CC0 표시와 애니메이션 미리보기를 확인했다. 검을 어깨 위/뒤에 둔 준비 자세를 참고했다. 다운로드 파일을 게임에 편입하지 않았다.
- [Ordinary Bumblebee — Customizable Character Pack](https://ordinary-bumblebee.itch.io/customizable-character-pack): 제작자 페이지에서 무료 CC0, 4방향 검 공격을 포함한 8종 애니메이션을 확인했다. 비교 후보이며 개별 검 프레임을 추출·편입한 자료는 아니다.
- [Thomas Vasseur — Dead Cells animation production](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-): 최소 핵심 자세와 타이밍을 먼저 정하고 타격을 읽히게 한다는 제작 방식을 참고했다. 해당 문서의 보행 GIF를 보았으며 특정 검 공격 영상을 분석했다고 주장하지 않는다.
- [Sakamoto Takashi — Kamae and suburi](https://kendojidai.com/2019/09/16/the-importance-of-kamae-and-suburi/): 몸과 검의 일치, 빠른 내려치기, 균형에 관한 설명을 참고했다. 실제 검술 훈련의 큰 올림 동작과 게임에서 짧게 읽히는 베기는 구분한다.

위 자료를 참고한 **프로젝트의 연출 판단**은 어깨 뒤 준비 → 빠른 사선 베기 → 아래쪽 회수다. 특정 게임의 원본 프레임을 복제하지 않는다.

## 구현

- `src/game/weapon-grips.ts`: 검·도는 공격 시작부터 어깨 뒤 준비 축을 사용한다. 준비 중의 움직임은 0.12rad로 제한한다. 접촉 전에는 가속하고 접촉 뒤에는 감속하여 조준 방향을 통과한다. 대기→준비는 의도적인 핵심 자세 전환이며 검이 앞쪽을 크게 돌아 올라가는 보간을 제거했다.
- `src/game/hero-attack-motion.ts`: 0.04~0.14초에 베며 기존 피해 시점 0.09초와 전체 공격 0.28초는 유지한다. 렌더 전진은 -2→6→8→0 월드 단위로 연결하고 헛베기에도 같은 시간선을 적용한다. 몸체 회전 역시 연속적으로 회수한다.
- `src/game/hero-slash.ts`: 베기 첫 30%까지 준비 그림을 유지하고 접촉 직전에 타격 그림으로 전환한다. 기존 v1의 150개 원화를 재사용한다. 이번 변경으로 새 원화를 생성한 것은 아니다.
- `src/game/blade-smear.ts`, `held-weapon.ts`: 실제 손 위치와 검날 길이 안에서 짧은 잔상만 그린다. 공격 범위선이 아니며 현재 손을 중심으로 궤적 일부를 샘플링한 연출이다. 준비·회수·장비 없음·사망 시 제거한다. 동작 감소 설정에서는 표시하지 않는다.
- 봉·부채·암기·권갑의 기존 각도 곡선은 유지한다. 손 부착·기본 공격 몸체 시간선은 공통이므로 함께 회귀 검사한다.

## 검증과 자료

- 단위 검사 46파일 1,221개와 프로덕션 빌드 통과.
- Canvas/WebGL 연속 렌더 4개 테스트 통과. 10종 × 6무기 × 3대표 방향 × 두 렌더러에서 접촉 표본 360개의 축 정합성을 확인했다. 일반 재생은 0.64초 동안 실제 프레임을 렌더한다.
- 준비·접촉 전·접촉·접촉 후·회수 화면을 직접 검토했다. 이는 렌더 시뮬레이션을 멈춘 자세 검토이며 전체 전투 플레이나 미적 품질의 자동 인증을 의미하지 않는다.
- 전체 무장 부착 검사 4개 테스트 통과: 10종 × 28개 장착 그림 × 8방향 × 일반/동작 감소 시간선 × 두 렌더러, 총 775,040개 표본에서 실패 0개. 최대 손 부착 오차는 약 `2.6e-13` 월드 단위로 기준 `0.01` 미만이다. 결과와 10종의 8방향 비교표는 `verification/hero-slash-v2/attachment/`에 기록한다. 마지막 화면 저장은 개발 서버 재로딩으로 한 차례 중단됐으며 해당 WebGL 배치를 단독 재실행해 통과했다.
- 실제 이동·반복 공격 입력과 가방 일시정지 회귀 검사 2개 통과. 테스트 저장은 독립 브라우저 컨텍스트만 사용했다. 영상은 `verification/directional-motion-v2/directional-play.webm`에 있다.
- [실제 프레임 GIF](verification/hero-slash-v2/player-cut-preview.gif), [접촉 비교](verification/hero-slash-v2/player-cut-contact.png), `continuous-0.webm` / `continuous-1.webm`, WebGL 영상과 JSON은 `verification/hero-slash-v2/`에 있다.

대각선 보행 방향 수정은 [이동 방향 기록](hero-walk-directions-v1.md)에 별도로 기록한다. 로비 고해상도 그림 작업은 사용자 우선순위에 따라 보류했다. 원화 제작·프레임 관리 규칙은 [v1 기록](hero-slash-v1.md)을 따른다.
