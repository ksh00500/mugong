# 소림 봉 승려 1종 · 방향 및 원화 프레임 연결

2026-10-04. 일반 봉 승려의 외형·방향·동작을 한 묶음으로 교체하고 로컬 `dist`에 반영했다. 소림 지역의 일반 `spear` 슬롯에만 적용한다. 대표 자세만 있는 소림 다른 6종은 기존 경로를 사용한다.

## 동작과 렌더링

- 원화 다섯 시점 × 12개 자세 = 60개. 앞/뒤를 포함한 8방향으로 재생한다. 좌우 반전한 방향도 발 기준점과 함께 반전한다.
- 보행은 왼발 → 중간 → 오른발 → 중간 순서이며 이동 거리의 gait를 따른다. 공격은 준비 2개 → 접촉 → 후속 자세 → 봉 회수 → 경계 자세다. 무기와 손은 원화에 같이 그려져 있다.
- 모든 프레임의 게임 배율은 **0.225**, 가로·세로 동일하다. 원본 추출·패킹에서도 리사이즈하지 않는다. 전달 칸은 704×576, 최소 여백 32픽셀이다.
- 새 봉 승려는 Phaser Image의 실제 프레임을 재생한다. 변형 Mesh를 중첩하지 않는다. 이번 경로의 Canvas·WebGL 캡처에서 조각 현상은 보이지 않았다. 다른 적의 기존 Mesh 경로까지 고친 결과는 아니다.
- 피격 직후 색 반응은 유지하되 공격 중에는 피격 그림으로 바꾸지 않는다. 준비가 실제 경직으로 취소되는 게임 규칙은 유지한다. 사망은 방향별 쓰러진 그림 1개와 기존 페이드다.
- HP바는 살아 있는 모든 자세와 봉 끝의 최대 높이, 추가 여유를 포함한 **115.9 월드픽셀** 간격으로 고정한다. 프레임별 크기 변화로 머리가 바를 뚫는 처리는 하지 않는다.

원본·프롬프트·탈락 시안·실제 비율 측정은 [원화 README](source/shaolin-staff-v1/README.md)에 기록했다. 자세에 따른 픽셀 윤곽의 차이는 남아 있으며 머리 폭이 수치상 완전히 동일하다는 주장은 하지 않는다.

## 코드와 재생성

- `src/game/authored-enemy.ts`: 방향과 상태별 실제 그림 선택, 저장한 프레임 등록.
- `src/game/shaolin-staff-frames.json`: 프레임 경계·발 좌표·공통 배율·HP 높이.
- `src/game/CombatScene.ts`: 새 프레임의 일반 이미지 렌더링 및 HP바.
- `src/platform/region-art.ts`: 소림 지역의 새 그림 10장 로드.
- `scripts/export-shaolin-staff.mjs`: 연결된 원본 픽셀 보존·여백·좌표 내보내기. Node 22에서는 `--experimental-strip-types`를 사용한다. Sharp 위치는 `MUGONG_SHARP_PATH`로 지정할 수 있다.
- `scripts/measure-shaolin-staff.mjs`: 원본 피부 영역 크기 보조 측정.
- `scripts/staff-review.mjs`: 저장한 원본 프레임을 사용하는 정적 검토 화면 생성.

## 검증

자동 검사와 사람이 캡처를 보는 검토는 별도다. 실제 사용자 저장에는 쓰지 않았으며 Playwright의 독립 컨텍스트만 사용했다.

- 전체 단위 검사 **49파일 / 1,238개 통과**, TypeScript 및 production build 통과.
- 관련 브라우저 검사 **22개 통과**: 새 봉 4가지 Canvas/WebGL·감소된 움직임 조합, 8방향 실제 피해 시점 2개, 소림 7종의 크기/HP/전환 7개, 실제 이동·공격 3개 화면 크기, 7종 방향 전환, 시작 프로파일 2개, production 화면 3개.
- 새 봉 시범의 1,120개 방향/단계 샘플에서 공통 배율, 올바른 원화 시점, 반전, Mesh 중첩 없음, 실제 이미지 알파 상단과 HP바의 간격을 확인했다.
- 실제 게임 시뮬레이션을 진행하여 8방향 모두 피해가 발생하는 틱에 접촉 그림 `combat-2`를 표시하는 것을 Canvas와 WebGL에서 대조했다.
- 전투 초기화는 그림 준비 완료 후 Canvas 약 **2.39초**, 소프트웨어 WebGL 약 **3.88초**였다. 이 머신과 해당 테스트의 관측치이며 모든 기기의 보장값이 아니다. 새 그림 등록에는 런타임 픽셀 검사가 없다.
- production 검사는 `/assets/main-…` 번들 로드를 확인하고 1440×900, 1093×614에서 입력과 10개 새 WebP의 HTTP 200을 확인했다. 검토 화면의 재생·정지·동작 선택도 검사했다.

캡처의 크기, 발 접지, 봉의 연결, 방향·짧은 반응 및 조각 여부를 직접 비교했다. 새 시범에서 공격 시의 일괄 축소나 HP바 침범은 보이지 않았다. 비율은 원본 그림 사이에 소폭 차이가 있어 향후 원화 검수에서 더 다듬을 수 있다.

증거: [방향별 실제 게임 비교 캡처](verification/shaolin-staff-v1/webgl-full-0.35.png), [Canvas 실제 접촉](verification/shaolin-staff-v1/canvas-damage-contact.json), [WebGL 실제 접촉](verification/shaolin-staff-v1/webgl-damage-contact.json), [로컬 배포 캡처](verification/shaolin-staff-v1/production/combat-1440.png). 시작 프로파일은 `docs/verification/combat-startup-v1/staff-v1-*-profile.json`이다.

로컬 실행: [게임](http://127.0.0.1:5173/) · [8방향 동작 검토](http://127.0.0.1:5173/art/shaolin-staff-v1/review.html).
