# 전장 구역 그림·제단 제거·가방 도구 · 2026-10-02

제단의 생성·접촉 보상·적 체력 강화·공격력 배율과 현재 데이터 정의를 제거했다. 기존 저장을 읽을 때 정상적인 이전 제단 구역과 사용 플래그만 제거한다. 원본 저장은 읽기 과정에서 변경하지 않으며 금화·체력·물품·사망·웨이브는 보존한다. 복구도 마지막 커밋과 동일한 검증 사본만 사용한다. 제단과 무관한 저장 손상은 계속 거부한다.

자동 정리는 사용자 표시 위치인 일반 가방 제목과 `10×8` 사이 중앙으로 이동했다. 높이 590px 이하 또는 너비 900px 이하에서는 가방 작업 공간 상단으로 이동한다. 두 격자와 선택 물품 행동은 유지하고 전체 화면 축소를 사용하지 않는다. 구역 그림으로 인해 가방 높이를 늘리지 않는다.

## 실제 그림과 판정

| 그림 | 사용하는 구역 |
| --- | --- |
| 독 웅덩이 | 독무곡 환경·독병 착지·독 보스 함정 |
| 냉기 | 얼음 장판·설산 보스 눈보라 |
| 가시 함정 | 고묘 함정·일반 지뢰·발사 지점 |
| 보라 진법 | 팔진고성 위험 구역·봉인·적 깃발 영향 범위 |
| 화롯불 | 설산의 기존 온기 구역 |
| 혈지대 | 혈마전 보스의 혈술 |
| 연막 | 연막 보스·죽림 시야 효과 |
| 녹색 진법 | 안전지대·플레이어 제갈 진법 |
| 불길 | 고묘 보스의 화공 패턴 |
| 모래 | 서역 보스 모래 효과·지역 모래바람 |
| 쇠사슬 | 연결 지점, 실제 줄과 탈출 범위는 별도 표시 |
| 깨진 술병 | 술병 보스의 웅덩이 |

벽·빙벽·깃발·정화초·포탑·상자에는 기존 래스터 소품을 유지한다. 정확한 공격 부채꼴·투척 착지 원·발동 시계·연결선·구역 외곽선은 판정 데이터에서 그린다. 이 선들은 위험 범위 안내이며 실제 지형 그림과 별개다. 그림은 캐릭터보다 낮은 깊이에 배치하고 준비 중 0.2~0.24, 발동 후 종류별 0.4~0.68의 알파를 사용한다. 추가 진동이나 입력 지연은 없다.

PNG 알파에서 각 그림의 외곽과 중심에서 가장 먼 불투명 픽셀을 측정했다. 이 길이로 그림 크기를 환산하여 그림과 원형 구역 반지름을 맞춘다. 캐릭터의 접촉 여유 18은 기존 판정 규칙을 유지한다. 쇠사슬 소품은 지점에 작게 놓고 탈출 범위 전체를 큰 소품으로 채우지 않는다. 구역 그림은 별도 64개 제한 이미지 풀에서 재사용하고 소멸·웨이브 전환에 숨김, 장면 종료에 파괴한다.

## 생성 파일과 프롬프트

내장 `image_gen` 도구로 생성 및 한 차례 스타일/여백 수정했다. 생성 원본을 프로젝트에 복사한 다음 WebP로 형식 변환했으며 Python으로 그림을 편집하지 않았다. 생성 PNG는 보관하고 런타임에서는 알파를 유지한 WebP 두 장만 읽는다.

- [기본 구역 원본](../public/art/zone-art-v1/zones-source.png), [런타임](../public/art/zone-art-v1/zones.webp)
- [추가 구역 원본](../public/art/zone-art-v1/special-source.png), [런타임](../public/art/zone-art-v1/special.webp)
- [프레임과 반지름 측정](../src/platform/zone-frames.json)

기본 생성 프롬프트:

> Create a transparent game sprite atlas, 4 columns by 2 rows, eight equally sized cells. Cartoon wuxia game ground effects viewed from directly overhead, clean ink outlines, hand painted flat shading, restrained colors. Each effect centered inside its cell with ample transparent padding, no dividing lines or background. Top row left to right: green bubbling poisonous puddle; pale blue cracked ice patch with small frost crystals; concealed ground trap with short iron spikes and cracked stones; violet ink magical danger formation. Bottom row left to right: warm orange patch with a small traditional charcoal brazier at its center; dark crimson blood pool; soft gray smoke cloud covering the ground; jade green protective ink formation. Ground patches broadly circular but organically shaped. No text, arrows, triangles, UI, altars or characters. The ground must remain visible through translucent parts of the effects. These are in-game effect sprites, not inventory icons.

최종 수정 프롬프트:

> Keep these eight ground effect sprites in their same 4-column 2-row order. Make the style simpler cartoon ink drawing with flatter shading and less rock detail. Important: each sprite centered in its equal cell and only 75% of the cell width and height, leaving generous fully transparent margins on all four sides; no part touching an edge or neighboring sprite. Small brazier should be noticeably smaller within its warm patch. Retain real transparency and translucent smoke/pools. No text or UI.

추가 생성 프롬프트:

> A transparent game sprite atlas with exactly four equal square cells in one horizontal row. Cartoon wuxia, overhead view, bold ink outlines, flat hand painted shading. Each sprite centered with generous transparent padding, separated, no background, labels or UI. Left to right: a circular patch of glowing embers and small orange flames, no brazier; a pale golden sand swirl on the ground; a coiled dark iron chain lying on the ground with a small anchor weight; spilled amber wine puddle with a few pieces of a broken traditional ceramic wine jar. Simple clear silhouettes and partly translucent ground effects, matching a colorful cartoon martial arts action game.

## 검증

TypeScript·Vite 빌드와 단위 검사 324개가 통과했다. 로컬 브라우저의 서로 다른 시나리오 57개를 검증했다: 기존 웨이브 진행 20개, 가방 조작 6개, 지역·성장·5언어 도구 배치 21개, 반응형 2개, 구역 이미지 7개와 이전 저장 로드 1개. 마지막 UI 보정 후 가방 6개·반응형 2개·구역/저장 8개 및 지역 검사 16개를 다시 통과했고, 1093×614 다섯 언어는 진입 애니메이션 완료를 기다린 뒤 5개 모두 다시 통과했다. 동작 중인 모달의 임시 확대율을 버튼 최종 크기로 오인하지 않도록 측정 시점만 바로잡았다. 마지막 저장 보완에서는 이전 선택적 값의 명시적 `undefined`를 허용하되 손상된 음수 구역 ID는 거부하고, IndexedDB 로드·저장 시나리오를 다시 통과했다.

반응형 검사는 20개 창 크기 × 9상태와 긴 영어 5크기 × 5상태에서 화면 밖 행동·박스 넘침·버튼 겹침을 검사하며 최종 실패 목록은 비어 있다. 구역 검사는 실제 Phaser 이미지·그림 종류·레이어 깊이·투명도·120회 반복 렌더 재사용·소멸 후 잔상 없음과 JavaScript 예외 없음을 확인했다. 이전 제단 저장을 실제 IndexedDB에 넣은 독립 브라우저에서 로드·자동 저장 후 금화·물품·무인·적·웨이브 보존을 확인했다.

직접 시각 검토는 1093×614·1366×768 가방, 설산 온기/냉기, 혈마전 혈지대/연막/봉인/안전지대, 고묘 불길/쇠사슬 캡처와 두 생성 원본을 열어 수행했다. 모든 보스의 난이도를 사람이 반복 플레이해 검증했다는 뜻은 아니다. 테스트 상태는 독립 Playwright 브라우저에서만 사용하고 실제 사용자 저장을 변경하지 않았다.

증거: [구역 캡처](verification/zone-art-v1/region-1.png), [설산](verification/zone-art-v1/region-3.png), [혈마전](verification/zone-art-v1/region-8.png), [가방](verification/regional-identity-v1/bag-1093.png), [반응형 결과](verification/responsive-v1/result.json), [영어 결과](verification/responsive-v1/english.json).
