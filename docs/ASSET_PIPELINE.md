# Asset Pipeline

이 저장소의 모든 게임 그래픽은 **에셋 단위로 분리해서 GitHub에 저장**한다.

## 절대 규칙

1. 완성된 전투방 한 장을 통째로 굽는 `room plate` 방식은 사용하지 않는다.
2. 캐릭터, 적, UI, 피, 검격, 조명 효과를 배경 이미지 안에 포함하지 않는다.
3. 청하현 맵은 독립 에셋을 Phaser에서 조합해 만든다.
4. 런타임에서 쓰는 에셋만 `public/assets/` 아래에 둔다.
5. 컨셉/레퍼런스/실패본은 `art/` 아래에 분리한다.
6. 파일 하나가 하나의 책임을 가진다. 예: 바위 1개, 울타리 1세그먼트, 대나무 1클러스터.
7. 새 에셋을 추가할 때 `public/assets/manifest.json`의 상태도 같이 갱신한다.
8. 승인 전 에셋은 production 화면에 섞지 않는다.
9. **공통 마나/MP/내공 게이지는 존재하지 않는다.** UI 에셋에 MP/Mana/내공 자원을 임의로 추가하지 않는다.
10. 하단 중앙 자원 UI가 필요한 경우에만 **현재 선택 무공 전용 자원**을 사용한다. 무공마다 명칭/형태가 다를 수 있으며, 없는 무공은 표시하지 않는다.
11. UI는 환경/플레이어/적/VFX의 실제 인게임 스케일이 고정된 뒤 제작한다. 컨셉 시트에 임의 UI를 섞지 않는다.
12. 여러 오브젝트를 한 이미지에 묶은 에셋 시트는 런타임 에셋으로 쓰지 않는다. **각 오브젝트를 별도 파일**로 저장한다.
13. 맵 에셋 배치는 통짜 배경이 아니라 독립 파일 조합으로 구성한다.

## 폴더

- `art/reference/` : 골든 레퍼런스
- `art/source/` : 원본/작업 소스
- `art/rejected/` : 실패본과 폐기본
- `public/assets/environment/` : 배경/맵 구성요소
- `public/assets/characters/` : 플레이어/적
- `public/assets/vfx/` : 검격/피격/사망 등
- `public/assets/ui/` : 최종 UI
- `public/assets/manifest.json` : 전체 에셋 상태

## 청하현 최초 구성 순서

ground dirt → path/decal → bamboo clusters → rocks → fence → hut → brazier/barrels → banner → foreground foliage → shadows/ambient decals

맵 제작은 한 작업 묶음에서 진행하되 결과물은 반드시 **오브젝트별 독립 파일**로 저장한다.
예: ground_dirt_01 / path_decal_01 / bamboo_cluster_01 / rock_large_01 / fence_segment_01 등.

각 파일은 **생성 → 개별 검수 → GitHub 저장 → manifest 갱신 → 런타임 적용** 순서를 지킨다.

## UI 시스템 고정 규칙

- 기본 HUD의 공통 자원은 HP와 현실 수명만 기준으로 삼는다.
- **Mana / MP / 공통 내공 바 금지.**
- 무공 전용 자원은 무공별로 별도 정의한다. 예: 궁극기 충전, 취기 등.
- 존재하지 않는 시스템을 보기 좋다는 이유로 UI에 추가하지 않는다.
- 이전에 생성된 MP/마나 포함 UI 컨셉 이미지는 전부 폐기본으로 취급한다.
