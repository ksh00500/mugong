# 무공 그림 에셋 · v1

2026-09-28. built-in `image_gen`으로 생성한 PNG를 게임에 적용했다. 프롬프트를 단순하게 유지하고 그림 안에는 UI 글자를 넣지 않았다.

## 저장 및 적용

| 파일 | 적용 |
| --- | --- |
| `public/art/ui/symbols-v1.png` | 물품 7종, 무공 5종, 세가 인장 및 보조 물품 · 4×4 |
| `public/art/ui/navigation-v1.png` | 가방·창고·설정·회전 등 메뉴 그림 16종 · 4×4 |
| `public/art/ui/materials-v1.png` | 한지·옥·천·가죽 표면 · 2×2 |
| `public/art/ui/lobby-v2.png` | 로비 산문과 세가 배경 |
| `public/art/ui/effects-v1.png` | 검기·타격·방어·광역 효과 · 2×2 |

`PaintedSprite`는 PNG 시트의 구역을 SVG 뷰포트로 표시한다. 그림을 벡터 선으로 재작성하지 않으며 clipPath는 이웃 그림이 표시되지 않도록 자르는 용도로만 사용한다. UI 글자와 수납 영역은 HTML, 전투 위협 예고와 체력 수치는 도형/텍스트로 유지한다. 무장 4×7·일반 10×8, 클릭·키보드·드래그 수납 규칙은 바꾸지 않았다.

전투 효과는 재사용하는 Phaser 이미지 풀로 표시한다. 이기어검과 발사체도 그림 검으로 표시한다. 감소된 움직임 설정에서는 장식 회전을 줄인다.

## 생성 프롬프트

### symbols

Use case: stylized-concept. A square transparent sprite atlas for a cartoon wuxia game, exactly 4 columns by 4 rows of equal square cells, one centered illustration per cell, generous clear margins, no grid lines or text. Colored cel-shaded painted objects with bold silhouettes, warm brass, jade, ivory and red, moderate detail readable at small size. Reading order: 1 silver straight sword upright, 2 jade medicine bottle, 3 blue stitched martial arts book, 4 ivory martial robe; 5 black leather boots, 6 jade pendant with red tassel, 7 iron ore cluster, 8 pink plum blossoms surrounding a sword emblem; 9 teal taiji sword emblem, 10 crimson demonic sword emblem, 11 three golden swords emblem, 12 plain silver sword emblem; 13 red wax seal with crossed swords, 14 closed travel satchel, 15 wooden storage chest, 16 golden coin stack. Genuine transparent background.

### navigation

Use case: stylized-concept. Square transparent game UI sprite atlas, exactly 4 by 4 equal cells, one centered icon per cell, wide clear margins. Wuxia cartoon painted filled icons, readable simple silhouettes, cel shading, warm brass and jade, no letters, no grid. Reading order: travel bag, wooden warehouse chest, ivory cross close button, two brass pause bars; curved golden rotation arrow, gold right arrow, red heart, silver sword; rolled parchment record, hourglass, question mark medallion, compass; ringing brass bell, crossed-out bell, brass gear, small disposal brazier. Genuine transparent background.

### materials

Use case: stylized-concept. Square cartoon wuxia game UI material sheet, exactly 2 by 2 equal square tiles filling the canvas edge to edge. Top left warm ivory handmade parchment with subtle fiber, brass corner caps and a fine inset frame; top right dark jade lacquer panel with gold corners and quiet center; bottom left light warm woven travel bag linen with stitched padded edges; bottom right chestnut leather with brass rivets and embossed edge. Painted cel shading, tactile handcrafted surfaces, restrained detail, blank centers for readable UI text. No text, no objects, no gaps between tiles.

### lobby

Use case: stylized-concept. Wide illustrated background for a cartoon wuxia game lobby: a quiet martial clan courtyard overlooking misty jade mountains, tiled roofs, bamboo and red lanterns. Warm morning light, stylized cel shading, clear hand-painted shapes, moderate detail, same ivory jade red palette as a cartoon swordsman. Open quiet center for a character, left side mostly pale mist for readable menu text. No people, no text, no interface.

### effects

Use case: stylized-concept. Transparent square cartoon wuxia combat VFX atlas, exactly 2 by 2 equal cells, centered effects with clear margins. Top left: bold ivory and gold curved sword slash crescent opening toward the right. Top right: ivory golden sharp impact burst. Bottom left: teal circular protective energy ring. Bottom right: crimson circular ink-flame shockwave. Painted cel-shaded filled energy shapes, punchy and readable, no thin wireframe, no text, genuine transparent background.

## 검증

- 빌드와 브라우저 조작 검사를 수행한다. 그림 5개가 디코딩되는지, 투명 시트에 실제 alpha가 있는지 별도로 검사한다.
- `docs/verification/graphic-ui-v1/`에 로비, 모든 종류의 물품과 네 무공이 있는 가방, 성장 카드, 전투의 실행 화면을 보관한다. 테스트 데이터는 Playwright 독립 컨텍스트에서만 사용했다.
- 자동 검사는 화면 경계·수납·창고·초점·전투를 확인한다. 시각 검토에서는 화풍·아이콘 구역·글자 대비·그림 크기를 확인한다. 서비스 출시 품질 인증을 의미하지 않는다.


최종 검증: 빌드 성공. 기존 전체 17개 중 첫 실행에서 16개 통과, 작은 창 성장 카드 크기를 수정해 실패한 1개를 포함한 관련 3개 재검증 통과. 그림 디코딩·투명도·모든 물품 표시 검사 1개 추가 통과. 마지막 전투·성장·가방·창고·그림 관련 6개 검사 통과 후, 물품 칸의 이름 대신 선택 정보·툴팁을 사용하도록 정리하고 가방·회전·창고·그림 관련 4개 검사 통과.

직접 시각 검토: 로비·전투·무공 카드와 1440×900, 1366×768, 1093×614 가방을 확인했다. 실제 앱에서는 최신 로비를 확인하고 키보드로 창고 열기·닫기·초점 복귀를 확인했다. PNG 시트 이웃 그림이 노출되던 현상을 클리핑으로 수정했다. 테스트 저장은 독립 브라우저에만 기록했다.


## 테두리 없는 재질과 담백한 효과 · v2

2026-09-29. 최신 UI는 `public/art/ui/materials-v2.webp`와 `public/art/ui/effects-v2.webp`를 사용한다. 이전 v1은 원본 기록으로 보존하며 런타임 참조에서 교체했다. built-in `image_gen`으로 생성한 PNG를 작업 공간에 복사한 뒤 손실 없는 WebP로 변환했다. 효과의 실제 alpha를 확인했다.

- `public/art/ui/materials-v2.png`: 한지·옥·천·가죽 재질, 장식 테두리·모서리·재봉선 없음. 패널과 수납 칸 경계는 실제 HTML 박스에 표시한다.
- `public/art/ui/effects-v2.png`: 얇은 검흔·작은 타격 조각·옅은 방어 표시·먼지. 타격은 최대 120ms, 베기/찌르기는 최대 160ms, 먼지는 최대 200ms, 방어 표시는 최대 260ms. 판정과 게임 규칙은 변경하지 않는다.

재질 생성 프롬프트:

> Use case: stylized-concept. Square 2×2 material texture sheet for a friendly cartoon wuxia game UI. Four equal edge-to-edge tiles: top left warm ivory handmade paper, top right muted dark jade lacquer, bottom left pale warm woven linen, bottom right muted chestnut leather. Very quiet low-contrast painted textures. Frameless plain surfaces throughout: no borders, trim, corners, seams, panels, objects, lettering or decorative lines.

효과 생성 프롬프트:

> Use case: stylized-concept. Game effect sprite sheet, four isolated small painted cartoon effects in equal 2×2 square cells on transparent background: upper left a thin ivory sword-swipe crescent; upper right a tiny ivory impact with three muted orange flecks; lower left a simple pale teal guard crescent; lower right a soft dusty ground puff. Flat hand-drawn shapes, understated, crisp silhouettes, generous empty space inside each cell. No glowing aura, dragons, flames, symbols, characters, text or frame.

최신 화면과 검증은 [한눈에 보는 UI](glance-ui-v2.md)에 둔다.

공개 전송에는 `art/delivery-v1/`의 품질 90 WebP 사본을 쓴다. PNG 원본과 위의 손실 없는 WebP를 보존했으며, 전송용 사본의 해상도·alpha는 원본과 같다. 장식선 제거와 효과 디자인은 image_gen으로 생성한 원본에 포함되어 있다. 파일 크기와 로딩 검증은 한눈에 보는 UI 기록에 둔다.
