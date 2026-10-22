# 무공

2026-10-07 서역사막 특별 원화: [4보스·8패턴·40장 생성과 검토 시안](docs/desert-special-v1.md). 로컬 비교 화면에서 8방향과 6자세를 확인한다. 기본 대비 몸 크기·접지와 일부 손 연결 교정이 남아 있어 게임 적용·공개 배포와 구분한다.

최신 보스 특수 원화: [청하현 4명·8행동의 8방향 모션](docs/qingha-special-v1.md). 소림·천검산·독무곡 다음 지역을 로컬에 적용했다. 청하현 나머지 12행동은 기존 방향별 원화를 사용한다. [검증 결과](docs/verification/qingha-special-v1/README.md), [독무곡](docs/dokmu-special-v1.md), [천검산](docs/tianjian-special-v1.md), [소림](docs/shaolin-special-v1.md).

최신 보스 대응: [지속 후퇴·이동 사격에 대한 추격 보법·전진 공격·선행 조준](docs/boss-pressure-v1.md). 40종 공통 연결을 로컬에 적용했으며 최종 실전 밸런스와 공개 배포는 별도다.

최신 전투 로딩: [그림 완료 뒤 10~20초 지연 원인과 픽셀 처리 최적화](docs/combat-startup-v1.md). 다운로드 이후의 프레임 분리 비용을 줄이고 렌더용 그림의 픽셀 일치를 확인했다. 로컬 프리뷰에 반영한다.

최신 플레이어 무기 동작: [6무기의 프레임별 손·각도 배치와 실제 비교 화면](docs/hero-weapon-v4.md). 검·도·봉·부채·암기·권갑을 구분하고 자동 검날 단축을 제거했다. 로컬 프리뷰에서 확인한다.

최신 적 크기·HP바: [10지역 공통 배율 기준 통일과 실제 전투 검증](docs/enemy-scale-health-v3.md). 소림의 보행·공격 기준 혼용과 방향에 따른 목표 크기 변경을 제거하고, 모든 적의 HP바에 그림 높이를 반영했다. 이전 [소림 v2](docs/monk-scale-v2.md)·[v1](docs/monk-scale-v1.md)은 당시 검증 기록이다.

최신 로컬 검 모션: [사용자 참고 시트에 맞춘 높은 준비·횡베기·낮은 마무리](docs/hero-slash-v3.md). 플레이어 10종의 검·도 기본 공격 궤적과 자세 전환을 수정했다.

주인공 무기 부착: [10종 외형·6종 무기·28개 물품 원화의 전체 프레임 감사](docs/weapon-attachment-v1.md). 캐릭터별 손 기준점, 실제 메시 연결, 회전축과 전투용 낱개 암기/권갑을 적용했다. [2026-10-04 Daytona 배포·공개 검증](docs/daytona-weapon-boss-v1.md) 완료.

보스 개편: [1차](docs/boss-melee-v1.md)·[2차](docs/boss-melee-v2.md)·[3~5차 후속](docs/boss-followup-v3-v5.md)까지 **40/40명·185개 전용 행동** 적용. 근접/원거리 정체성, 실제 접촉·기믹·모션·저장 재개를 검증했다. 2026-10-04 Daytona 배포 완료이며 실전 밸런스는 별도다.

최신 변경: [캐릭터 중심 성장·타고난 특성·성장 특성·무공 수련](docs/character-growth-v2.md), [실제 이동 상태 기준 렌더링과 AI 급전환 완화](docs/hostile-jitter-investigation.md). [장판 윤곽 제거·적/보스 무기와 투사체 점검](docs/hostile-presentation-v2.md), [장비 소수점·보스 난이도 강화](docs/balance-v2.md)를 포함한다.

최신 변경: [기마·암살자·적 조준·투사체 회수·얼음 폭탄·창병 판정 수정](docs/enemy-combat-v1.md). [제단 제거·12종 구역 그림·일반 가방 상단 자동 정리](docs/zone-art-v1.md), [10지역 적 정체성·40보스 개인 패턴](docs/regional-identity-v1.md)과 [무기·성장·획득 물품 개선](docs/pending-weapon-growth-v1.md)을 유지한다.

[Daytona에서 플레이](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/) · [최신 배포·공개 주소 검증](docs/daytona-weapon-boss-v1.md) (2026-10-04).

보스 이름표의 중앙 정렬·그림 안쪽 여백·체력 숫자 배치: [보정과 검증](docs/boss-nameplate-v1.md).

전투 후 가방·필드의 큰 진행 버튼과 닫기/재개 흐름: [웨이브 진행 UX](docs/wave-progression-v1.md).

원거리 무기·지역 적의 전용 투사체와 착용 전 비교: [구현과 검증](docs/projectiles-comparison-v1.md).

최신 가방 흐름: [전투 중 무공 연결·전투 후 가방 자동 열기·자동 정리](docs/bag-flow-v1.md).

최신 무공 성장: [2성·4성 자동 보조 효과](docs/martial-support-v1.md). 배운 무공이 현재 무공의 공격·방어·회복·충전을 함께 보조한다.

최신 물품 그림: [92종 전용 그림과 무협 신발 수정본](docs/item-art-v2.md). 가방·창고·전리품·상점에서 같은 물품 그림을 사용한다.

최신 강호 시스템: [92개 물품·드랍·정비·강화·완주 정산과 검증](docs/gangho-completion-v1.md). [전체 물품 목록](docs/items-v1.md)은 실제 코드 데이터에서 생성한다.

최신 동작: [주인공·일반 적 30종·보스 40종의 팔방 연속 애니메이션](docs/directional-motion-v2.md). 앞·옆·뒤 방향 그림 350장과 런타임 메시 보간, WebGL/Canvas를 적용했다. 이전 자세 시트는 [적 동작 v1](docs/enemy-motion-v1.md)에 기록했다.

최신 지역 그림: [배경 10장·일반 적 30종·보스 40종과 로딩/동작 검증](docs/region-art-v1.md).

최신 원본 기획 반영: [보스 특수 행동·전용 전리품·그래픽과 검증](docs/boss-encounters-v2.md). 기반 콘텐츠는 [10지역·40보스·8계열 무공](docs/content-expansion-v1.md)에 기록한다.

다음 개발을 위한 보스·레이드·비무·생사결·온라인 설계안: [다음 단계 설계](docs/next-stage-design.md). 신규 정책과 수치는 추천 초안이며 현재 구현 범위와 구분한다.

현재 구현의 결함 수정·검증과 남은 작업: [전체 검토 기록](docs/audit-v1.md).

최신 전투 개선: [타격감·공격 예고·방어 피드백과 검증](docs/combat-feel-v1.md).

카툰풍 탑뷰 무협 액션의 첫 브라우저 플레이 버전. 새 무인을 Lv.0에서 시작해 강호 20웨이브를 완주하고 세가 명부에 등록한다.

## 실행

Node.js 22.12 이상. 프로젝트 루트에서 실행한다.

```powershell
npm ci
npm run dev
```

접속: http://127.0.0.1:5173/

```powershell
npm test
npm run test:e2e
npm run build
```

브라우저 검증 전에 `npx playwright install chromium`을 한 번 실행한다. pnpm을 선호하는 경우 같은 package.json 스크립트를 `pnpm dev`, `pnpm test` 등으로 실행할 수 있다. 이 버전의 의존성 고정 파일은 package-lock.json이다.

## 조작

| 입력                 | 행동                                 |
| -------------------- | ------------------------------------ |
| WASD                 | 이동                                 |
| 좌클릭 / 누르고 있기 | 클릭 방향 기본 공격                  |
| 우클릭               | 현재 무공의 궁극 행동                |
| Q / E                | 보유 무공 전환                       |
| Space                | 현재 무공에 따른 회피·반격·최근 손실 회복·방어 |
| Tab / I              | 가방                                 |
| Esc                  | 일시 정지                            |
| 가방에서 R           | 선택 물품의 수납 방향 회전           |

전투 중 가방은 강호를 멈추며 무장 가방의 호환 무기를 무공에 연결할 수 있다. 클릭은 물품 선택만 한다. 전투가 끝나면 가방이 바로 열린다. 드래그로 원하는 칸에 옮기거나 수납·가방 이동 버튼으로 배치하며, 자동 정리 버튼으로 가방 배치와 획득 물품 수납을 한 번에 실행한다. 구매품과 드랍은 획득 물품에 모인다. 닫아도 유지되며 다음 웨이브·귀환 시 남은 물품을 확인한다. 다음 웨이브·귀환도 가방 하단에서 진행한다. 이동 버튼은 Tab과 Enter/Space로도 실행한다. 가방 안 물품의 R 회전은 현재 위치에 바로 반영하며 공간이 부족하면 변경하지 않는다. 로비로 일시 종료할 때는 Esc → 저장하고 일시 종료를 사용한다.

레벨업 무공 카드가 나타나면 공격 중 오입력을 막기 위해 1초 동안 선택이 잠긴다. 남은 시간이 표시되고, 시간이 지나면 카드가 활성화된다.

귀환한 무인의 로비 가방에서는 창고를 함께 표시한다. 창고 물품을 드래그하거나 선택한 뒤 ‘수납’을 눌러 꺼내고, 가방 물품은 창고로 드래그하거나 ‘창고로’를 눌러 보관한다. 창고의 중첩 물품은 한 개씩 꺼낸다. 강호에는 창고 자산을 반입할 수 없다. 최신 수정과 검증은 [조작 개선](docs/interactions-v3.md)에 기록한다.

## 구현 범위

- 모집권으로 성장 배율·타고난 특성이 다른 후보 3명 중 선택. 캐릭터 레벨업은 기본 능력 성장, Lv.10/25/50은 별도 성장 특성 선택. 무공은 웨이브·보스 완료로 얻는 수련으로 성장한다.
- 신규 8계열 무공 Lv.5 상한, 기존 삼재 Lv.6–10은 유지. 최대 네 무공, 계열별 무장 연결·Space 행동·궁극기·검기·진법.
- 10지역 중 중복 없는 네 지역을 선정하는 20웨이브. 지역별 단계 보스 40종과 환경 판정, 정비 네 번·보스 네 번. 보스는 현재 공통 두 외형과 여덟 공격 유형을 조합한다.
- 전투 후 획득 물품, 분리된 테트리스 가방, 무기 연결, 소모품·착용 장비.
- 6종 무기의 3단계, 지역별 장비/재료와 40보스 보상을 포함한 92개 물품. 정비 상인의 한정 재고, 의원, 재료 판매와 두 번 강화.
- 저장 성공 후 완주 결과, 남은 금전의 세가 정산과 최근 10개 여정 기록. 세가 자금은 현재 누적 기록이며 지출처는 후속 단계다.
- 로비·명부·창고·기록, 현실 7일 수명과 만료 시 물품 회수.
- IndexedDB 이어하기, 사망·성장 카드·난수 상태 저장, 저장 실패 시 진행 차단·재시도, 지원 브라우저에서 단일 탭 쓰기 잠금.

계정·온라인 레이드·시장·PVP·터치 조작·모바일 앱은 후속 단계다. 이 로컬 버전의 자산은 온라인 서비스 계정으로 이전하지 않는다. 로컬 저장은 이 브라우저·이 사이트 주소에 속하며 서버의 부정행위 검증을 대신하지 않는다.

## 구조

`src/domain`은 화면에 의존하지 않는 전투·성장·수납 규칙, `src/game`은 Phaser 렌더링과 입력, `src/ui`는 React 관리 화면, `src/platform`은 저장·세션·오디오다. 기존 `prototype/`은 이전 회화적 동작 비교 자료이며 새 게임의 실행 경로가 아니다.

새 런타임 에셋과 생성 기록은 `public/art` 및 [런타임 에셋 기록](docs/runtime-art-v1.md)에 있다. 규칙과 검증의 상세 기록은 [개발 기준](docs/implementation-v1.md)과 [검증 결과](docs/implementation-verification.md)를 참조한다.

최신 디자인·전투 연출과 창고 연동 변경은 [전투 연출·UI 개선](docs/ui-combat-polish-v1.md)에 기록했다.

메인 로비의 전체 디자인과 동작 검증은 [메인 로비 UI·UX](docs/home-ui-v1.md)에 기록했다.

최신 서체·색·UI 규칙은 [DESIGN.md](DESIGN.md), 적용 결과는 [디자인 시스템 고도화](docs/ui-design-system-v2.md)를 참조한다.

화면별 정보 위계와 문구·조작 원칙은 [UX.md](UX.md)를 따른다. 참고한 공개 Markdown 원문과 라이선스는 `docs/reference/web-interface-guidelines.md`, `docs/reference/web-interface-guidelines-license.txt`에 보관했다.

로비·전투 HUD·성장 선택·가방·창고의 최신 화면, 고대비·큰 HUD 설정과 검증 결과는 [서비스 UI 고도화](docs/service-ui-v1.md)에 기록했다.

전체 화면 UI·UX 기준: [가이드와 라이선스](docs/reference/ui-ux-guides.md), [전체 화면 적용·검증](docs/viewport-ui-v2.md). 이후 UI 작업은 [AGENTS.md](AGENTS.md)의 검토 기준을 따른다.

그림 에셋 적용 및 생성 프롬프트: [그림 그래픽 v1](docs/graphic-assets-v1.md).

공개 플레이 링크·서버 재실행·배포 검증: [Daytona 배포 기록](docs/daytona-deployment.md).

한국어·영어·일본어·중국어 간체·번체와 브라우저 언어 감지: [언어 지원과 검증](docs/language-v1.md).

150% 글자·큰 버튼·탭 가방·칸 수·드래그 개선과 검증: [UI 확대와 가방 개선](docs/readability-bag-v2.md).

텍스트 줄바꿈·무공 상세·무손실 WebP·시작/전투 로딩과 복구: [텍스트와 로딩 개선](docs/text-loading-v3.md).

무공 상세 설명은 대상에 마우스 또는 키보드 초점을 둔 채 Shift를 누르면 표시하며, 성장 화면의 설명 버튼으로 고정할 수 있다. 기본 화면에서는 숨긴다. 전리품의 약·비급은 전투 후 바로 사용 가능하다. 품질별 효과와 다섯 언어 문구 검토 기록: [상세 설명과 전리품 사용](docs/details-v4.md).

블록 배치·패딩·정보 묶음·패널과 버튼의 겹침 점검: [배치·간격 개선](docs/layout-spacing-v3.md).

가방은 이름·레벨 아래 상태·무공 아이콘/레벨·착용 장비를 함께 표시한다. 정보 탭 없이 선택 물품과 두 격자를 유지하고 작은 그림 드래그 미리보기와 필요한 페이지만 사용한다. [가방 요약 개선과 검증](docs/inventory-summary-v5.md).

- [창고 전용 화면과 빠른 이동 단축키](docs/storage-shortcuts-v1.md)

- [범위선 없는 전투 표시](docs/combat-presentation-v1.md)

- [플레이어 10종 베기 원화·무기 궤적 개선](docs/hero-slash-v1.md)
- [보스 피격·CC 면역과 원거리 대응 설계 검토](docs/boss-resilience-v1.md)
- [무료 검객 에셋 참고와 검 베기 시간선 개선](docs/hero-slash-v2.md)
- [플레이어 10종 대각선 보행 방향 수정](docs/hero-walk-directions-v1.md)
