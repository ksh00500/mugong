# UI 디자인 시스템 고도화

2026-09-28. 기준 문서는 저장소 루트의 [DESIGN.md](../DESIGN.md)다.

[Google Labs의 공개 DESIGN.md 형식 명세](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md)를 라이선스와 함께 `docs/reference`에 내려받아 구조를 참고했다. 외부 제품의 색이나 컴포넌트를 복제하지 않고 무공의 한지·먹·옥·황동·주홍 시각 언어를 정의했다. `designmd lint DESIGN.md` 결과 오류 0건, 경고 0건이다.

서체는 [Gowun Batang](https://github.com/google/fonts/tree/main/ofl/gowunbatang) Regular/Bold를 제목에, [Gowun Dodum](https://github.com/google/fonts/tree/main/ofl/gowundodum) Regular를 본문에 쓴다. OFL 라이선스 파일을 함께 보관하고 WOFF2로 압축해 로컬 제공한다. 세 파일 합계 약 1.47MB다. 글꼴을 내려받지 못한 환경에서는 시스템 바탕·맑은 고딕으로 돌아간다.

본문·상태·안내 글씨의 크기와 대비를 올리고, 버튼의 포커스·호버, 카드 경계, 창 제목, 가방 설명, HUD 보조 정보를 공통 규칙에 맞췄다. 초상과 숲 그림은 그대로 유지한다. 디자인 토큰의 제목·본문·보조 글씨와 옥색 버튼에 대해 목표 배경에서 대비값을 계산했고, 최소 4.97:1이다. 반투명 그림 위의 모든 조합에 대한 자동 접근성 인증은 아니다.

실제 브라우저에서 로비 1440×900·1366×768·1024×768·390×844, 생성·귀환·이어하기, 가방·HUD를 확인했다. 브라우저 테스트 12개와 프로덕션 빌드가 통과했다. 로컬 글꼴 로딩도 브라우저 테스트로 확인했다.

[로비](verification/design-system-v2/lobby.png) · [귀환 명부](verification/design-system-v2/roster.png) · [가방](verification/design-system-v2/inventory.png) · [전투 HUD](verification/design-system-v2/combat.png) · [작은 화면](verification/design-system-v2/mobile.png)
