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

각 항목을 **한 장씩 생성 → 검수 → GitHub 저장 → 런타임 적용**한다.
